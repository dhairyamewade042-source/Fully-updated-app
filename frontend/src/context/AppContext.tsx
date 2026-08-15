// Global app state / mutation API.
//
// The whole app data blob (customers, sales, payments, orders, settings) lives
// in memory once hydrated from AsyncStorage. Every mutation immediately
// persists a fresh copy — writes are cheap because the dataset is small
// (single-user business ledger).
//
// FIFO payment allocation is implemented in `rebuildCustomerLedger`, which is
// called after any mutation that could affect a customer's balance. This keeps
// bill-editing, payment-editing, deletion and manual entries always consistent
// with the FIFO rule (oldest unpaid bill is cleared first).

import dayjs from "dayjs";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { loadAppData, saveAppData } from "@/src/lib/db";
import { uid } from "@/src/lib/id";
import {
  AppData,
  Customer,
  EMPTY_APP_DATA,
  Order,
  OrderStatus,
  Payment,
  Sale,
  Settings,
  TraderBill,
} from "@/src/lib/types";
import { darkTheme, lightTheme, Theme } from "@/src/lib/theme";

interface AddSaleInput {
  customerName: string;
  phone?: string;
  date: string;
  quantityKg: number;
  pricePerKg: number;
  received: number; // initial received on this bill
}

interface Ctx {
  hydrated: boolean;
  data: AppData;
  theme: Theme;
  // Derived helpers
  getCustomer: (id: string) => Customer | undefined;
  customerBalance: (customerId: string) => number;
  customerBills: (customerId: string) => Sale[]; // sorted oldest first
  pendingBills: (customerId: string) => Sale[]; // sorted oldest first (pending > 0)
  customerPayments: (customerId: string) => Payment[];
  totals: () => {
    todaySales: number;
    todayQuantity: number;
    totalPending: number;
    pendingCustomers: number;
    todayOrders: number;
    tomorrowOrders: number;
    totalCustomers: number;
  };
  // Sale mutations
  addSale: (input: AddSaleInput) => Promise<Sale>;
  updateSale: (
    id: string,
    patch: {
      date?: string;
      quantityKg?: number;
      pricePerKg?: number;
      initialReceived?: number;
    },
  ) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  // Payment mutations
  receivePayment: (customerId: string, amount: number, date?: string) => Promise<Payment>;
  updatePayment: (id: string, patch: { amount?: number; date?: string }) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  // Customer
  upsertCustomerByName: (name: string, phone?: string) => Customer;
  updateCustomer: (id: string, patch: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  // Orders
  addOrder: (input: Omit<Order, "id" | "estimatedTotal" | "createdAt" | "status"> & {
    status?: OrderStatus;
  }) => Promise<Order>;
  updateOrder: (id: string, patch: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  duplicateOrder: (id: string) => Promise<Order | null>;
  convertOrderToSale: (id: string, receivedNow: number) => Promise<Sale | null>;
  // Trader bills (raw material purchases)
  addTraderBill: (
    input: Omit<TraderBill, "id" | "createdAt">,
  ) => Promise<TraderBill>;
  updateTraderBill: (id: string, patch: Partial<TraderBill>) => Promise<void>;
  deleteTraderBill: (id: string) => Promise<void>;
  toggleTraderBillPaid: (id: string) => Promise<void>;
  // Meta
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  importAll: (raw: unknown) => Promise<{ ok: boolean; error?: string }>;
  exportAll: () => AppData;
  wipeAll: () => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);

// ------------------------------------------------------------
// Pure helpers
// ------------------------------------------------------------
const round2 = (n: number) => Math.round(n * 100) / 100;

// Recompute `sale.received` and `payment.appliedTo` for a customer.
// Rule:
//   1. Each sale.received starts at sale.initialReceived.
//   2. Payments are applied in chronological order (oldest first).
//   3. Each payment is allocated FIFO across the customer's unpaid sales
//      (oldest sale first).
const rebuildCustomerLedger = (prev: AppData, customerId: string): AppData => {
  const sales = prev.sales.slice();
  const payments = prev.payments.slice();

  // Reset received on all sales of this customer.
  for (let i = 0; i < sales.length; i++) {
    if (sales[i].customerId === customerId) {
      sales[i] = {
        ...sales[i],
        received: Math.min(sales[i].initialReceived, sales[i].total),
      };
    }
  }
  // Clear all appliedTo arrays of this customer's payments.
  for (let i = 0; i < payments.length; i++) {
    if (payments[i].customerId === customerId) {
      payments[i] = { ...payments[i], appliedTo: [] };
    }
  }

  // Sorted references (do not mutate the original array positions).
  const customerPaymentIdxs = payments
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.customerId === customerId)
    .sort(
      (a, b) =>
        a.p.date.localeCompare(b.p.date) || a.p.createdAt.localeCompare(b.p.createdAt),
    )
    .map(({ i }) => i);

  const customerSaleIdxs = sales
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.customerId === customerId)
    .sort(
      (a, b) =>
        a.s.date.localeCompare(b.s.date) || a.s.createdAt.localeCompare(b.s.createdAt),
    )
    .map(({ i }) => i);

  for (const pIdx of customerPaymentIdxs) {
    let remaining = payments[pIdx].amount;
    const applied: { saleId: string; amount: number }[] = [];
    for (const sIdx of customerSaleIdxs) {
      if (remaining <= 0.0001) break;
      const s = sales[sIdx];
      const owed = s.total - s.received;
      if (owed <= 0.0001) continue;
      const take = Math.min(owed, remaining);
      sales[sIdx] = { ...s, received: round2(s.received + take) };
      applied.push({ saleId: s.id, amount: round2(take) });
      remaining = round2(remaining - take);
    }
    payments[pIdx] = { ...payments[pIdx], appliedTo: applied };
  }

  return { ...prev, sales, payments };
};

const upsertCustomerByNameSync = (
  prev: AppData,
  name: string,
  phone?: string,
): { data: AppData; customer: Customer } => {
  const cleaned = name.trim();
  const existing = prev.customers.find(
    (c) => c.name.trim().toLowerCase() === cleaned.toLowerCase(),
  );
  if (existing) {
    if (phone && !existing.phone) {
      const patched: Customer = { ...existing, phone };
      const nextCustomers = prev.customers.map((c) => (c.id === existing.id ? patched : c));
      return { data: { ...prev, customers: nextCustomers }, customer: patched };
    }
    return { data: prev, customer: existing };
  }
  const created: Customer = {
    id: uid(),
    name: cleaned,
    phone: phone?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  return { data: { ...prev, customers: [...prev.customers, created] }, customer: created };
};

// ------------------------------------------------------------
// Provider
// ------------------------------------------------------------
export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<AppData>(EMPTY_APP_DATA);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const loaded = await loadAppData();
      setData(loaded);
      setHydrated(true);
    })();
  }, []);

  const commit = useCallback(async (mut: (prev: AppData) => AppData) => {
    let next: AppData = EMPTY_APP_DATA;
    setData((prev) => {
      next = mut(prev);
      return next;
    });
    await saveAppData(next);
  }, []);

  // -------- derived helpers --------
  const getCustomer = useCallback(
    (id: string) => data.customers.find((c) => c.id === id),
    [data.customers],
  );

  const customerBills = useCallback(
    (customerId: string) =>
      data.sales
        .filter((s) => s.customerId === customerId)
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    [data.sales],
  );

  const pendingBills = useCallback(
    (customerId: string) => customerBills(customerId).filter((s) => s.total - s.received > 0.0001),
    [customerBills],
  );

  const customerPayments = useCallback(
    (customerId: string) =>
      data.payments
        .filter((p) => p.customerId === customerId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [data.payments],
  );

  const customerBalance = useCallback(
    (customerId: string) => {
      const bills = data.sales.filter((s) => s.customerId === customerId);
      return bills.reduce((acc, s) => acc + (s.total - s.received), 0);
    },
    [data.sales],
  );

  const totals = useCallback(() => {
    const today = dayjs().format("YYYY-MM-DD");
    const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");
    const todaySales = data.sales
      .filter((s) => dayjs(s.date).format("YYYY-MM-DD") === today)
      .reduce((a, s) => a + s.total, 0);
    const todayQuantity = data.sales
      .filter((s) => dayjs(s.date).format("YYYY-MM-DD") === today)
      .reduce((a, s) => a + s.quantityKg, 0);
    const totalPending = data.sales.reduce((a, s) => a + Math.max(0, s.total - s.received), 0);
    const pendingCustomerIds = new Set<string>();
    data.sales.forEach((s) => {
      if (s.total - s.received > 0.0001) pendingCustomerIds.add(s.customerId);
    });
    const todayOrders = data.orders.filter(
      (o) => o.deliveryDate === today && o.status !== "cancelled" && o.status !== "completed",
    ).length;
    const tomorrowOrders = data.orders.filter(
      (o) => o.deliveryDate === tomorrow && o.status !== "cancelled" && o.status !== "completed",
    ).length;
    return {
      todaySales,
      todayQuantity,
      totalPending,
      pendingCustomers: pendingCustomerIds.size,
      todayOrders,
      tomorrowOrders,
      totalCustomers: data.customers.length,
    };
  }, [data]);

  // -------- customer mutations --------
  const upsertCustomerByName = useCallback(
    (name: string, phone?: string) => {
      let out: Customer = {} as Customer;
      commit((prev) => {
        const { data: nextData, customer } = upsertCustomerByNameSync(prev, name, phone);
        out = customer;
        return nextData;
      });
      return out;
    },
    [commit],
  );

  const updateCustomer = useCallback(
    async (id: string, patch: Partial<Customer>) => {
      await commit((prev) => ({
        ...prev,
        customers: prev.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        sales: patch.name
          ? prev.sales.map((s) => (s.customerId === id ? { ...s, customerName: patch.name! } : s))
          : prev.sales,
        orders: patch.name
          ? prev.orders.map((o) => (o.customerId === id ? { ...o, customerName: patch.name! } : o))
          : prev.orders,
      }));
    },
    [commit],
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      await commit((prev) => ({
        ...prev,
        customers: prev.customers.filter((c) => c.id !== id),
        sales: prev.sales.filter((s) => s.customerId !== id),
        payments: prev.payments.filter((p) => p.customerId !== id),
        orders: prev.orders.filter((o) => o.customerId !== id),
      }));
    },
    [commit],
  );

  // -------- sale mutations --------
  const addSale = useCallback<Ctx["addSale"]>(
    async ({ customerName, phone, date, quantityKg, pricePerKg, received }) => {
      const total = round2(quantityKg * pricePerKg);
      const receivedClamped = Math.max(0, Math.min(received, total));
      const now = new Date().toISOString();
      let sale: Sale = {} as Sale;
      await commit((prev) => {
        const { data: withCustomer, customer } = upsertCustomerByNameSync(prev, customerName, phone);
        sale = {
          id: uid(),
          customerId: customer.id,
          customerName: customer.name,
          date,
          quantityKg,
          pricePerKg,
          total,
          initialReceived: receivedClamped,
          received: receivedClamped,
          createdAt: now,
        };
        const withSale: AppData = { ...withCustomer, sales: [...withCustomer.sales, sale] };
        // Existing payments may FIFO-consume the new bill (rare, but possible
        // if user back-dates a sale before an existing payment).
        return rebuildCustomerLedger(withSale, customer.id);
      });
      return sale;
    },
    [commit],
  );

  const updateSale = useCallback<Ctx["updateSale"]>(
    async (id, patch) => {
      await commit((prev) => {
        const target = prev.sales.find((s) => s.id === id);
        if (!target) return prev;
        const nextTotal =
          patch.quantityKg !== undefined || patch.pricePerKg !== undefined
            ? round2(
                (patch.quantityKg ?? target.quantityKg) *
                  (patch.pricePerKg ?? target.pricePerKg),
              )
            : target.total;
        const nextInitial = Math.max(
          0,
          Math.min(
            patch.initialReceived !== undefined ? patch.initialReceived : target.initialReceived,
            nextTotal,
          ),
        );
        const nextSales = prev.sales.map((s) =>
          s.id === id
            ? {
                ...s,
                date: patch.date ?? s.date,
                quantityKg: patch.quantityKg ?? s.quantityKg,
                pricePerKg: patch.pricePerKg ?? s.pricePerKg,
                total: nextTotal,
                initialReceived: nextInitial,
                received: nextInitial,
              }
            : s,
        );
        return rebuildCustomerLedger({ ...prev, sales: nextSales }, target.customerId);
      });
    },
    [commit],
  );

  const deleteSale = useCallback(
    async (id: string) => {
      await commit((prev) => {
        const target = prev.sales.find((s) => s.id === id);
        if (!target) return prev;
        const nextSales = prev.sales.filter((s) => s.id !== id);
        // Also strip any allocations that pointed at this sale.
        const nextPayments = prev.payments.map((p) =>
          p.customerId === target.customerId
            ? { ...p, appliedTo: p.appliedTo.filter((a) => a.saleId !== id) }
            : p,
        );
        return rebuildCustomerLedger(
          { ...prev, sales: nextSales, payments: nextPayments },
          target.customerId,
        );
      });
    },
    [commit],
  );

  // -------- payment mutations --------
  const receivePayment = useCallback<Ctx["receivePayment"]>(
    async (customerId, amount, date) => {
      const payDate = date || new Date().toISOString();
      let payment: Payment = {} as Payment;
      await commit((prev) => {
        payment = {
          id: uid(),
          customerId,
          amount: round2(amount),
          date: payDate,
          appliedTo: [],
          createdAt: new Date().toISOString(),
        };
        const withPayment = { ...prev, payments: [...prev.payments, payment] };
        return rebuildCustomerLedger(withPayment, customerId);
      });
      return payment;
    },
    [commit],
  );

  const updatePayment = useCallback<Ctx["updatePayment"]>(
    async (id, patch) => {
      await commit((prev) => {
        const target = prev.payments.find((p) => p.id === id);
        if (!target) return prev;
        const nextPayments = prev.payments.map((p) =>
          p.id === id
            ? {
                ...p,
                amount: patch.amount !== undefined ? round2(patch.amount) : p.amount,
                date: patch.date ?? p.date,
              }
            : p,
        );
        return rebuildCustomerLedger({ ...prev, payments: nextPayments }, target.customerId);
      });
    },
    [commit],
  );

  const deletePayment = useCallback(
    async (id: string) => {
      await commit((prev) => {
        const target = prev.payments.find((p) => p.id === id);
        if (!target) return prev;
        const nextPayments = prev.payments.filter((p) => p.id !== id);
        return rebuildCustomerLedger({ ...prev, payments: nextPayments }, target.customerId);
      });
    },
    [commit],
  );

  // -------- orders --------
  const addOrder = useCallback<Ctx["addOrder"]>(
    async (input) => {
      const estimatedTotal = round2(input.quantityKg * input.expectedPricePerKg);
      const now = new Date().toISOString();
      let created: Order = {} as Order;
      await commit((prev) => {
        let customerId = input.customerId;
        let nextData = prev;
        if (!customerId) {
          const { data: d2, customer } = upsertCustomerByNameSync(prev, input.customerName, input.phone);
          nextData = d2;
          customerId = customer.id;
        }
        created = {
          id: uid(),
          customerId,
          customerName: input.customerName,
          phone: input.phone,
          orderDate: input.orderDate,
          deliveryDate: input.deliveryDate,
          deliveryTime: input.deliveryTime,
          quantityKg: input.quantityKg,
          expectedPricePerKg: input.expectedPricePerKg,
          estimatedTotal,
          address: input.address,
          notes: input.notes,
          status: input.status || "pending",
          createdAt: now,
        };
        return { ...nextData, orders: [...nextData.orders, created] };
      });
      return created;
    },
    [commit],
  );

  const updateOrder = useCallback(
    async (id: string, patch: Partial<Order>) => {
      await commit((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => {
          if (o.id !== id) return o;
          const merged = { ...o, ...patch };
          merged.estimatedTotal = round2(merged.quantityKg * merged.expectedPricePerKg);
          return merged;
        }),
      }));
    },
    [commit],
  );

  const deleteOrder = useCallback(
    async (id: string) => {
      await commit((prev) => ({ ...prev, orders: prev.orders.filter((o) => o.id !== id) }));
    },
    [commit],
  );

  const duplicateOrder = useCallback<Ctx["duplicateOrder"]>(
    async (id) => {
      let copy: Order | null = null;
      await commit((prev) => {
        const src = prev.orders.find((o) => o.id === id);
        if (!src) return prev;
        copy = {
          ...src,
          id: uid(),
          status: "pending",
          createdAt: new Date().toISOString(),
          orderDate: dayjs().toISOString(),
        };
        return { ...prev, orders: [...prev.orders, copy] };
      });
      return copy;
    },
    [commit],
  );

  const convertOrderToSale = useCallback<Ctx["convertOrderToSale"]>(
    async (id, receivedNow) => {
      const order = data.orders.find((o) => o.id === id);
      if (!order) return null;
      const sale = await addSale({
        customerName: order.customerName,
        phone: order.phone,
        date: new Date().toISOString(),
        quantityKg: order.quantityKg,
        pricePerKg: order.expectedPricePerKg,
        received: receivedNow,
      });
      await updateOrder(id, { status: "completed" });
      return sale;
    },
    [addSale, data.orders, updateOrder],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      await commit((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    },
    [commit],
  );

  // -------- trader bills --------
  const addTraderBill = useCallback<Ctx["addTraderBill"]>(
    async (input) => {
      let created: TraderBill = {} as TraderBill;
      await commit((prev) => {
        created = {
          ...input,
          id: uid(),
          createdAt: new Date().toISOString(),
        };
        return { ...prev, traderBills: [...prev.traderBills, created] };
      });
      return created;
    },
    [commit],
  );

  const updateTraderBill = useCallback(
    async (id: string, patch: Partial<TraderBill>) => {
      await commit((prev) => ({
        ...prev,
        traderBills: prev.traderBills.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      }));
    },
    [commit],
  );

  const deleteTraderBill = useCallback(
    async (id: string) => {
      await commit((prev) => ({
        ...prev,
        traderBills: prev.traderBills.filter((b) => b.id !== id),
      }));
    },
    [commit],
  );

  const toggleTraderBillPaid = useCallback(
    async (id: string) => {
      await commit((prev) => ({
        ...prev,
        traderBills: prev.traderBills.map((b) =>
          b.id === id
            ? {
                ...b,
                paid: !b.paid,
                paidDate: !b.paid ? new Date().toISOString() : undefined,
              }
            : b,
        ),
      }));
    },
    [commit],
  );

  const importAll = useCallback<Ctx["importAll"]>(
    async (raw) => {
      if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid backup file" };
      const r = raw as Partial<AppData>;
      if (!Array.isArray(r.customers) || !Array.isArray(r.sales) || !Array.isArray(r.orders)) {
        return { ok: false, error: "Backup is missing required sections" };
      }
      await commit(() => {
        const merged: AppData = {
          ...EMPTY_APP_DATA,
          ...(r as AppData),
          traderBills: Array.isArray((r as any).traderBills) ? (r as any).traderBills : [],
          settings: { ...EMPTY_APP_DATA.settings, ...(r.settings || {}) },
        };
        // Backfill initialReceived on imported sales, if missing.
        const applied = new Map<string, number>();
        (merged.payments || []).forEach((p) =>
          p.appliedTo?.forEach((a) =>
            applied.set(a.saleId, (applied.get(a.saleId) || 0) + a.amount),
          ),
        );
        merged.sales = merged.sales.map((s) => ({
          ...s,
          initialReceived:
            (s as Sale).initialReceived !== undefined
              ? (s as Sale).initialReceived
              : Math.max(0, s.received - (applied.get(s.id) || 0)),
        }));
        return merged;
      });
      return { ok: true };
    },
    [commit],
  );

  const exportAll = useCallback(() => data, [data]);

  const wipeAll = useCallback(async () => {
    await commit(() => EMPTY_APP_DATA);
  }, [commit]);

  const theme = data.settings.darkMode ? darkTheme : lightTheme;

  const value = useMemo<Ctx>(
    () => ({
      hydrated,
      data,
      theme,
      getCustomer,
      customerBalance,
      customerBills,
      pendingBills,
      customerPayments,
      totals,
      upsertCustomerByName,
      updateCustomer,
      deleteCustomer,
      addSale,
      updateSale,
      deleteSale,
      receivePayment,
      updatePayment,
      deletePayment,
      addOrder,
      updateOrder,
      deleteOrder,
      duplicateOrder,
      convertOrderToSale,
      addTraderBill,
      updateTraderBill,
      deleteTraderBill,
      toggleTraderBillPaid,
      updateSettings,
      importAll,
      exportAll,
      wipeAll,
    }),
    [
      hydrated,
      data,
      theme,
      getCustomer,
      customerBalance,
      customerBills,
      pendingBills,
      customerPayments,
      totals,
      upsertCustomerByName,
      updateCustomer,
      deleteCustomer,
      addSale,
      updateSale,
      deleteSale,
      receivePayment,
      updatePayment,
      deletePayment,
      addOrder,
      updateOrder,
      deleteOrder,
      duplicateOrder,
      convertOrderToSale,
      addTraderBill,
      updateTraderBill,
      deleteTraderBill,
      toggleTraderBillPaid,
      updateSettings,
      importAll,
      exportAll,
      wipeAll,
    ],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
};

export const useApp = () => {
  const v = useContext(AppCtx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
};
