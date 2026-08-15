// Pure helpers for the Purchase Bills (trader) views.
// Everything is DERIVED from the existing TraderBill data — no new write model.
// TraderBill currently stores a binary `paid` flag; if an optional numeric
// `paidAmount` is ever present on a bill we honour it (enables "Partially Paid").

import { TraderBill } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;
const EPS = 0.0001;

export type PurchaseStatus = "Paid" | "Partially Paid" | "Unpaid";

// Paid / remaining / status for a single bill, from existing payment data.
export const billPayment = (
  b: TraderBill,
): { paid: number; remaining: number; status: PurchaseStatus } => {
  const amount = round2(b.amount || 0);
  const rawPaid = (b as any).paidAmount;
  const paid =
    typeof rawPaid === "number"
      ? round2(Math.min(Math.max(0, rawPaid), amount))
      : b.paid
        ? amount
        : 0;
  const remaining = round2(Math.max(0, amount - paid));
  const status: PurchaseStatus =
    remaining <= EPS ? "Paid" : paid > EPS ? "Partially Paid" : "Unpaid";
  return { paid, remaining, status };
};

export interface PurchaseSummary {
  totalBills: number;
  pendingBills: number;
  outstanding: number;
}

export const purchaseSummary = (bills: TraderBill[]): PurchaseSummary => {
  let pendingBills = 0;
  let outstanding = 0;
  for (const b of bills) {
    const { remaining } = billPayment(b);
    if (remaining > EPS) {
      pendingBills += 1;
      outstanding = round2(outstanding + remaining);
    }
  }
  return { totalBills: bills.length, pendingBills, outstanding };
};

export interface TraderGroup {
  key: string; // normalised name (used for matching/routing)
  name: string; // display name
  phone?: string;
  billCount: number;
  totalPurchase: number;
  outstanding: number;
  pendingCount: number;
  lastDate: string; // latest bill date (ISO) for sorting
}

export const normTrader = (name: string) => name.trim().toLowerCase();

export const groupByTrader = (bills: TraderBill[]): TraderGroup[] => {
  const map = new Map<string, TraderGroup>();
  for (const b of bills) {
    const key = normTrader(b.traderName);
    const { remaining } = billPayment(b);
    const g =
      map.get(key) ||
      ({
        key,
        name: b.traderName.trim(),
        phone: b.phone,
        billCount: 0,
        totalPurchase: 0,
        outstanding: 0,
        pendingCount: 0,
        lastDate: b.date,
      } as TraderGroup);
    g.billCount += 1;
    g.totalPurchase = round2(g.totalPurchase + (b.amount || 0));
    g.outstanding = round2(g.outstanding + remaining);
    if (remaining > EPS) g.pendingCount += 1;
    if (!g.phone && b.phone) g.phone = b.phone;
    if (b.date > g.lastDate) g.lastDate = b.date;
    map.set(key, g);
  }
  return Array.from(map.values());
};

// Bills belonging to one trader (matched by normalised name), newest first.
export const billsForTrader = (bills: TraderBill[], traderName: string): TraderBill[] => {
  const key = normTrader(traderName);
  return bills
    .filter((b) => normTrader(b.traderName) === key)
    .sort((a, b) => b.date.localeCompare(a.date));
};
