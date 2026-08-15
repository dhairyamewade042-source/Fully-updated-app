// Customer Ledger — profile + purchases + payments + edit/delete + receive + manual entries + WhatsApp.

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateField } from "@/src/components/DateField";
import { Field } from "@/src/components/Field";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { showToast } from "@/src/components/Toast";
import { Body, Button, Card, EmptyState, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fmtDate, kg, money } from "@/src/lib/format";
import { exportHtmlAsPdf } from "@/src/lib/pdf";
import { fontSize, radius, spacing } from "@/src/lib/theme";
import { Sale, Payment } from "@/src/lib/types";
import { openWhatsApp, paymentReminder } from "@/src/lib/whatsapp";

// ---------------------------------------------------------------
// Bill editor modal
// ---------------------------------------------------------------
const BillEditor = ({
  visible,
  initial,
  customerName,
  onDismiss,
  onSave,
  onDelete,
}: {
  visible: boolean;
  initial: Partial<Sale> | null;
  customerName: string;
  onDismiss: () => void;
  onSave: (v: {
    date: string;
    quantityKg: number;
    pricePerKg: number;
    initialReceived: number;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) => {
  const { theme, data } = useApp();
  const currency = data.settings.currency;
  const [date, setDate] = useState(
    initial?.date ? dayjs(initial.date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
  );
  const [qty, setQty] = useState(initial?.quantityKg ? String(initial.quantityKg) : "");
  const [price, setPrice] = useState(initial?.pricePerKg ? String(initial.pricePerKg) : "");
  const [received, setReceived] = useState(
    initial?.initialReceived !== undefined ? String(initial.initialReceived) : "",
  );
  const [busy, setBusy] = useState(false);

  // Reset each time the modal is (re)opened
  React.useEffect(() => {
    if (!visible) return;
    setDate(
      initial?.date ? dayjs(initial.date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
    );
    setQty(initial?.quantityKg ? String(initial.quantityKg) : "");
    setPrice(initial?.pricePerKg ? String(initial.pricePerKg) : "");
    setReceived(initial?.initialReceived !== undefined ? String(initial.initialReceived) : "");
  }, [visible, initial]);

  const q = parseFloat(qty) || 0;
  const p = parseFloat(price) || 0;
  const total = +(q * p).toFixed(2);
  const r = Math.max(0, parseFloat(received) || 0);
  const canSave = q > 0 && p > 0;

  const submit = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      await onSave({
        date: dayjs(date).toISOString(),
        quantityKg: q,
        pricePerKg: p,
        initialReceived: r,
      });
      onDismiss();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: theme.surfaceSecondary, maxHeight: "90%" }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800" }}>
              {initial?.id ? "Edit Bill" : "Add Manual Bill"}
            </Text>
            <Body muted style={{ marginTop: spacing.xs }}>
              {customerName}
            </Body>
            <View style={{ height: spacing.md }} />

            <DateField label="Date" value={date} onChange={setDate} testID="bill-date" />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Quantity (kg)"
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="decimal-pad"
                  testID="bill-quantity"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label={`Price / kg (${currency})`}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  testID="bill-price"
                />
              </View>
            </View>

            <Card
              style={{
                backgroundColor: theme.brandTertiary,
                borderColor: theme.brandSecondary,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <Label>Total</Label>
                <Text
                  style={{ color: theme.onBrandTertiary, fontSize: fontSize.xxl, fontWeight: "800" }}
                >
                  {money(total, currency)}
                </Text>
              </View>
            </Card>

            <View style={{ height: spacing.lg }} />
            <Field
              label={`Amount Received (${currency})`}
              value={received}
              onChangeText={setReceived}
              keyboardType="decimal-pad"
              hint="Leave 0 to add the full amount to pending"
              testID="bill-received"
            />

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              {onDelete && initial?.id ? (
                <Button
                  label="Delete"
                  variant="danger"
                  onPress={async () => {
                    setBusy(true);
                    await onDelete();
                    setBusy(false);
                    onDismiss();
                  }}
                  loading={busy}
                  style={{ flex: 1 }}
                  testID="bill-delete"
                />
              ) : null}
              <Button
                label={initial?.id ? "Save" : "Add Bill"}
                onPress={submit}
                disabled={!canSave}
                loading={busy}
                style={{ flex: 1 }}
                testID="bill-save"
              />
            </View>
            <Body muted style={{ marginTop: spacing.md, fontSize: fontSize.sm }}>
              Any payments on this ledger are automatically re-allocated (FIFO) after saving.
            </Body>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ---------------------------------------------------------------
// Payment editor modal
// ---------------------------------------------------------------
const PaymentEditor = ({
  visible,
  initial,
  customerName,
  onDismiss,
  onSave,
  onDelete,
}: {
  visible: boolean;
  initial: Partial<Payment> | null;
  customerName: string;
  onDismiss: () => void;
  onSave: (v: { amount: number; date: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) => {
  const { theme, data } = useApp();
  const currency = data.settings.currency;
  const [date, setDate] = useState(
    initial?.date ? dayjs(initial.date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
  );
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setDate(
      initial?.date ? dayjs(initial.date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
    );
    setAmount(initial?.amount ? String(initial.amount) : "");
  }, [visible, initial]);

  const value = parseFloat(amount) || 0;
  const canSave = value > 0;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: theme.surfaceSecondary, maxHeight: "90%" }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800" }}>
              {initial?.id ? "Edit Payment" : "Add Manual Payment"}
            </Text>
            <Body muted style={{ marginTop: spacing.xs }}>
              {customerName}
            </Body>
            <View style={{ height: spacing.md }} />

            <DateField label="Date" value={date} onChange={setDate} testID="payment-date" />
            <Field
              label={`Amount (${currency})`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              testID="payment-amount"
            />

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              {onDelete && initial?.id ? (
                <Button
                  label="Delete"
                  variant="danger"
                  onPress={async () => {
                    setBusy(true);
                    await onDelete();
                    setBusy(false);
                    onDismiss();
                  }}
                  loading={busy}
                  style={{ flex: 1 }}
                  testID="payment-delete"
                />
              ) : null}
              <Button
                label={initial?.id ? "Save" : "Add Payment"}
                onPress={async () => {
                  if (!canSave || busy) return;
                  setBusy(true);
                  try {
                    await onSave({ amount: value, date: dayjs(date).toISOString() });
                    onDismiss();
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={!canSave}
                loading={busy}
                style={{ flex: 1 }}
                testID="payment-save"
              />
            </View>
            <Body muted style={{ marginTop: spacing.md, fontSize: fontSize.sm }}>
              Bills are re-allocated FIFO on save.
            </Body>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ---------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------
export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    theme,
    data,
    getCustomer,
    customerBills,
    customerPayments,
    customerBalance,
    customerAdvance,
    customerAdvanceHistory,
    updateCustomer,
    deleteCustomer,
    addSale,
    updateSale,
    deleteSale,
    receivePayment,
    updatePayment,
    deletePayment,
  } = useApp();
  const currency = data.settings.currency;
  const customer = id ? getCustomer(String(id)) : undefined;

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(customer?.name || "");
  const [editPhone, setEditPhone] = useState(customer?.phone || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [billEditor, setBillEditor] = useState<Partial<Sale> | null>(null);
  const [paymentEditor, setPaymentEditor] = useState<Partial<Payment> | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const bills = useMemo(() => (customer ? customerBills(customer.id) : []), [customer, customerBills]);
  const payments = useMemo(
    () => (customer ? customerPayments(customer.id) : []),
    [customer, customerPayments],
  );

  if (!customer) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.surface }}>
        <ScreenHeader title="Customer" showBack />
        <EmptyState
          title="Customer not found"
          icon={<Ionicons name="person-remove-outline" size={26} color={theme.brandPrimary} />}
        />
      </View>
    );
  }

  const pending = customerBalance(customer.id);
  const advance = customerAdvance(customer.id);
  const advanceHistory = customerAdvanceHistory(customer.id);
  const totalPurchased = bills.reduce((a, b) => a + b.total, 0);
  const totalReceived = totalPurchased - pending;
  const totalQty = bills.reduce((a, b) => a + b.quantityKg, 0);

  const escapeHtml = (s: string) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const buildLedgerHtml = (): string => {
    const businessName = data.settings.businessName;
    const rowsBills = bills
      .map((b, i) => {
        const pend = Math.max(0, b.total - b.received);
        const st = pend <= 0.0001 ? "Paid" : b.received <= 0.0001 ? "Unpaid" : "Partial";
        const color = st === "Paid" ? "#2E7D32" : st === "Partial" ? "#8A5A00" : "#D32F2F";
        const bg = st === "Paid" ? "#E8F5E9" : st === "Partial" ? "#FFF3CD" : "#FDECEA";
        return `<tr>
          <td>${i + 1}</td>
          <td>${fmtDate(b.date)}</td>
          <td class="num">${b.quantityKg}</td>
          <td class="num">${money(b.pricePerKg, currency)}</td>
          <td class="num">${money(b.total, currency)}</td>
          <td class="num">${money(b.received, currency)}</td>
          <td class="num">${money(pend, currency)}</td>
          <td><span class="badge" style="color:${color};background:${bg}">${st}</span></td>
        </tr>`;
      })
      .join("");

    const rowsPayments = payments
      .map((p, i) => {
        return `<tr>
          <td>${i + 1}</td>
          <td>${fmtDate(p.date)}</td>
          <td class="num">${money(p.amount, currency)}</td>
          <td>${p.appliedTo.length} bill${p.appliedTo.length === 1 ? "" : "s"}</td>
        </tr>`;
      })
      .join("");

    const rowsAdvance = advanceHistory
      .slice()
      .reverse()
      .map((h, i) => {
        const relBill = h.saleId ? bills.find((b) => b.id === h.saleId) : undefined;
        const isAdded = h.type === "added";
        const desc = isAdded
          ? h.paymentId
            ? "Added from payment"
            : relBill
              ? `Added from overpaid bill (${fmtDate(relBill.date)})`
              : "Advance added"
          : relBill
            ? `Used on bill (${fmtDate(relBill.date)})`
            : "Advance used on a bill";
        const color = isAdded ? "#2E7D32" : "#8A5A00";
        return `<tr>
          <td>${i + 1}</td>
          <td>${fmtDate(h.date)}</td>
          <td>${desc}</td>
          <td class="num" style="color:${color};font-weight:800">${isAdded ? "+" : "-"}${money(h.amount, currency)}</td>
        </tr>`;
      })
      .join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #1A1F1C; padding: 28px; }
        .head { border-bottom: 3px solid #2E7D32; padding-bottom: 14px; margin-bottom: 18px; }
        .brand { font-size: 20px; font-weight: 800; color: #1B5E20; }
        .title { font-size: 12px; letter-spacing: 1px; color: #5C6B5F; text-transform: uppercase; margin-top: 4px; }
        .cust { font-size: 22px; font-weight: 800; margin-top: 8px; }
        .sub { font-size: 12px; color: #5C6B5F; margin-top: 2px; }
        .cards { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 18px; }
        .stat { flex: 1 1 22%; border: 1px solid #E0E8E1; border-radius: 12px; padding: 12px 14px; background: #F4F7F4; }
        .stat .l { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #5C6B5F; font-weight: 700; }
        .stat .v { font-size: 18px; font-weight: 800; color: #1A1F1C; margin-top: 4px; }
        h2 { font-size: 14px; margin: 20px 0 8px; color: #1B5E20; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #EAF0EB; }
        th { background: #E8F5E9; color: #1B5E20; text-transform: uppercase; font-size: 10px; letter-spacing: .4px; }
        td.num, th.num { text-align: right; }
        .badge { padding: 3px 9px; border-radius: 999px; font-weight: 700; font-size: 11px; }
        .empty { color: #5C6B5F; font-style: italic; padding: 8px 2px; }
        .foot { margin-top: 26px; font-size: 10px; color: #8DA093; border-top: 1px solid #EAF0EB; padding-top: 10px; }
        tr.total td { font-weight: 800; background: #F4F7F4; border-top: 2px solid #C8E6C9; }
      </style></head>
      <body>
        <div class="head">
          <div class="brand">${escapeHtml(businessName)}</div>
          <div class="title">Customer Ledger Statement</div>
          <div class="cust">${escapeHtml(customer!.name)}</div>
          <div class="sub">${customer!.phone ? escapeHtml(customer!.phone) : "No phone"} · as on ${dayjs().format("DD MMM YYYY")}</div>
        </div>

        <div class="cards">
          <div class="stat"><div class="l">Total Purchased</div><div class="v">${money(totalPurchased, currency)}</div></div>
          <div class="stat"><div class="l">Total Received</div><div class="v">${money(totalReceived, currency)}</div></div>
          <div class="stat"><div class="l">Current Pending</div><div class="v" style="color:${pending > 0 ? "#D32F2F" : "#2E7D32"}">${money(pending, currency)}</div></div>
          <div class="stat"><div class="l">Advance Balance</div><div class="v" style="color:${advance > 0 ? "#2E7D32" : "#1A1F1C"}">${money(advance, currency)}</div></div>
        </div>

        <h2>Bills / Purchases</h2>
        ${bills.length === 0 ? '<div class="empty">No bills yet.</div>' : `<table>
          <thead><tr><th>#</th><th>Date</th><th class="num">Qty (kg)</th><th class="num">Price/kg</th><th class="num">Total</th><th class="num">Received</th><th class="num">Pending</th><th>Status</th></tr></thead>
          <tbody>${rowsBills}
            <tr class="total"><td></td><td>TOTAL</td><td class="num">${totalQty}</td><td></td><td class="num">${money(totalPurchased, currency)}</td><td class="num">${money(totalReceived, currency)}</td><td class="num">${money(pending, currency)}</td><td></td></tr>
          </tbody></table>`}

        <h2>Payments Received</h2>
        ${payments.length === 0 ? '<div class="empty">No payments recorded.</div>' : `<table>
          <thead><tr><th>#</th><th>Date</th><th class="num">Amount</th><th>Applied</th></tr></thead>
          <tbody>${rowsPayments}</tbody></table>`}

        <h2>Advance History</h2>
        ${advanceHistory.length === 0 ? '<div class="empty">No advance activity.</div>' : `<table>
          <thead><tr><th>#</th><th>Date</th><th>Detail</th><th class="num">Amount</th></tr></thead>
          <tbody>${rowsAdvance}</tbody></table>`}

        <div class="foot">Generated by ${escapeHtml(businessName)} · GarlicLedger Pro · ${dayjs().format("DD MMM YYYY, hh:mm A")}</div>
      </body></html>`;
  };

  const onExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportHtmlAsPdf(buildLedgerHtml());
    } finally {
      setExportingPdf(false);
    }
  };

  const openEdit = () => {
    setEditName(customer.name);
    setEditPhone(customer.phone || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editName.trim()) {
      showToast("Name is required", "error");
      return;
    }
    await updateCustomer(customer.id, {
      name: editName.trim(),
      phone: editPhone.trim() || undefined,
    });
    setEditOpen(false);
    showToast("Customer updated");
  };

  const doDelete = async () => {
    await deleteCustomer(customer.id);
    setConfirmDelete(false);
    showToast("Customer deleted", "info");
    router.back();
  };

  const sendWhatsApp = async () => {
    if (!customer.phone) {
      showToast("Add a phone number to send WhatsApp", "error");
      return;
    }
    const oldest = bills.find((b) => b.total - b.received > 0.0001);
    const ok = await openWhatsApp(
      customer.phone,
      paymentReminder({
        businessName: data.settings.businessName,
        customerName: customer.name,
        pendingAmount: pending.toLocaleString("en-IN", { maximumFractionDigits: 2 }),
        currency,
        oldestPendingDate: oldest ? dayjs(oldest.date).format("DD MMM YYYY") : undefined,
      }),
    );
    if (!ok) showToast("Couldn't open WhatsApp", "error");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader
        title={customer.name}
        subtitle={customer.phone || "No phone"}
        showBack
        right={
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            {customer.phone ? (
              <Pressable
                testID="customer-whatsapp"
                onPress={sendWhatsApp}
                hitSlop={10}
                style={{ padding: 6 }}
              >
                <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
              </Pressable>
            ) : null}
            <Pressable testID="customer-edit" onPress={openEdit} hitSlop={10} style={{ padding: 6 }}>
              <Ionicons name="create-outline" size={22} color={theme.brandPrimary} />
            </Pressable>
            <Pressable
              testID="customer-delete"
              onPress={() => setConfirmDelete(true)}
              hitSlop={10}
              style={{ padding: 6 }}
            >
              <Ionicons name="trash-outline" size={22} color={theme.error} />
            </Pressable>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 + insets.bottom }}>
        {/* Balance hero */}
        <Card
          testID="customer-balance-card"
          style={{
            backgroundColor: pending > 0 ? "#FDECEA" : theme.brandTertiary,
            borderColor: pending > 0 ? "#F5C6CB" : theme.brandSecondary,
          }}
        >
          <Label>Current Pending</Label>
          <Text
            testID="customer-pending"
            style={{
              color: pending > 0 ? theme.error : theme.onBrandTertiary,
              fontSize: 34,
              fontWeight: "800",
              marginTop: 2,
              letterSpacing: -0.5,
            }}
          >
            {money(pending, currency)}
          </Text>
          <View style={{ flexDirection: "row", marginTop: spacing.md, gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Label>Total Purchased</Label>
              <Text
                style={{
                  color: theme.onSurface,
                  fontSize: fontSize.lg,
                  fontWeight: "800",
                  marginTop: 2,
                }}
              >
                {money(totalPurchased, currency)}
              </Text>
              <Text style={{ color: theme.muted, fontSize: fontSize.xs, marginTop: 2 }}>
                {kg(totalQty)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Label>Received</Label>
              <Text
                style={{
                  color: theme.brandPrimary,
                  fontSize: fontSize.lg,
                  fontWeight: "800",
                  marginTop: 2,
                }}
              >
                {money(totalReceived, currency)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Advance balance */}
        <Card
          testID="customer-advance-card"
          style={{
            marginTop: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: advance > 0 ? theme.brandTertiary : theme.surfaceSecondary,
            borderColor: advance > 0 ? theme.brandSecondary : theme.border,
          }}
        >
          <View
            style={{
              height: 44,
              width: 44,
              borderRadius: radius.pill,
              backgroundColor: advance > 0 ? theme.brandPrimary : theme.border,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.md,
            }}
          >
            <MaterialCommunityIcons
              name="wallet-plus"
              size={22}
              color={advance > 0 ? "#FFF" : theme.muted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Label>Advance Balance</Label>
            <Text
              testID="customer-advance"
              style={{
                color: advance > 0 ? theme.onBrandTertiary : theme.onSurface,
                fontSize: fontSize.xxl,
                fontWeight: "800",
                marginTop: 2,
              }}
            >
              {money(advance, currency)}
            </Text>
            <Text style={{ color: theme.muted, fontSize: fontSize.xs, marginTop: 2 }}>
              {advance > 0
                ? "Auto-applied to the next bill"
                : "Extra payments are saved here automatically"}
            </Text>
          </View>
        </Card>

        {/* Primary actions */}
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          {pending > 0 ? (
            <Button
              testID="customer-receive-payment"
              label={`Receive ${money(pending, currency)}`}
              onPress={() => router.push(`/receive-payment/${customer.id}`)}
              icon={<MaterialCommunityIcons name="cash-plus" size={18} color="#FFF" />}
              style={{ flex: 1 }}
            />
          ) : null}
          <Button
            testID="customer-add-entry"
            label="Add Entry"
            variant="secondary"
            onPress={() => setAddMenu(true)}
            icon={<Ionicons name="add" size={18} color={theme.onBrandTertiary} />}
            style={{ flex: pending > 0 ? undefined : 1, paddingHorizontal: spacing.lg }}
          />
        </View>

        <Button
          testID="customer-export-pdf"
          label="Download Statement (PDF)"
          variant="secondary"
          onPress={onExportPdf}
          loading={exportingPdf}
          fullWidth
          style={{ marginTop: spacing.sm }}
          icon={<MaterialCommunityIcons name="file-pdf-box" size={20} color={theme.onBrandTertiary} />}
        />

        {/* Purchases */}
        <View
          style={{
            marginTop: spacing.xl,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Label>Purchase History</Label>
          <View style={{ flex: 1 }} />
          <Pressable
            testID="ledger-add-bill"
            onPress={() => setBillEditor({})}
            hitSlop={10}
          >
            <Text style={{ color: theme.brandPrimary, fontWeight: "700", fontSize: fontSize.sm }}>
              + Manual bill
            </Text>
          </Pressable>
        </View>
        {bills.length === 0 ? (
          <Card style={{ marginTop: spacing.sm, alignItems: "center" }}>
            <Body muted>No purchases yet</Body>
          </Card>
        ) : (
          bills.map((b) => {
            const bp = b.total - b.received;
            return (
              <Pressable
                key={b.id}
                testID={`bill-row-${b.id}`}
                onPress={() => setBillEditor(b)}
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <Card style={{ marginTop: spacing.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                    <View
                      style={{
                        height: 36,
                        width: 36,
                        borderRadius: radius.pill,
                        backgroundColor: bp > 0.0001 ? "#FDECEA" : theme.brandTertiary,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: spacing.md,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={bp > 0.0001 ? "cash-remove" : "check"}
                        size={18}
                        color={bp > 0.0001 ? theme.error : theme.brandPrimary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "700" }}
                      >
                        {fmtDate(b.date)}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                        {kg(b.quantityKg)} @ {money(b.pricePerKg, currency)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "800" }}
                      >
                        {money(b.total, currency)}
                      </Text>
                      <Text
                        style={{
                          color: bp > 0.0001 ? theme.error : theme.brandPrimary,
                          fontSize: fontSize.sm,
                          fontWeight: "700",
                          marginTop: 2,
                        }}
                      >
                        {bp > 0.0001 ? `Pending ${money(bp, currency)}` : "PAID"}
                      </Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}

        {/* Payments */}
        <View
          style={{
            marginTop: spacing.xl,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Label>Payment History</Label>
          <View style={{ flex: 1 }} />
          <Pressable
            testID="ledger-add-payment"
            onPress={() => setPaymentEditor({})}
            hitSlop={10}
          >
            <Text style={{ color: theme.brandPrimary, fontWeight: "700", fontSize: fontSize.sm }}>
              + Manual payment
            </Text>
          </Pressable>
        </View>
        {payments.length === 0 ? (
          <Card style={{ marginTop: spacing.sm, alignItems: "center" }}>
            <Body muted>No payments received yet</Body>
          </Card>
        ) : (
          payments.map((p) => (
            <Pressable
              key={p.id}
              testID={`payment-row-${p.id}`}
              onPress={() => setPaymentEditor(p)}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Card style={{ marginTop: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      height: 36,
                      width: 36,
                      borderRadius: radius.pill,
                      backgroundColor: theme.brandTertiary,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: spacing.md,
                    }}
                  >
                    <MaterialCommunityIcons name="cash-plus" size={18} color={theme.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "700" }}
                    >
                      Payment received
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                      {fmtDate(p.date)} · Applied to {p.appliedTo.length} bill
                      {p.appliedTo.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: theme.brandPrimary,
                      fontSize: fontSize.lg,
                      fontWeight: "800",
                    }}
                  >
                    {money(p.amount, currency)}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))
        )}

        {/* Advance history */}
        {advanceHistory.length > 0 ? (
          <>
            <View style={{ marginTop: spacing.xl }}>
              <Label>Advance History</Label>
            </View>
            {advanceHistory
              .slice()
              .reverse()
              .map((h) => {
                const relBill = h.saleId ? bills.find((b) => b.id === h.saleId) : undefined;
                const isAdded = h.type === "added";
                const desc = isAdded
                  ? h.paymentId
                    ? "Added from payment"
                    : relBill
                      ? `Added from overpaid bill (${fmtDate(relBill.date)})`
                      : "Advance added"
                  : relBill
                    ? `Used on bill (${fmtDate(relBill.date)})`
                    : "Advance used on a bill";
                return (
                  <Card
                    key={h.id}
                    testID={`advance-row-${h.id}`}
                    style={{ marginTop: spacing.sm, flexDirection: "row", alignItems: "center" }}
                  >
                    <View
                      style={{
                        height: 36,
                        width: 36,
                        borderRadius: radius.pill,
                        backgroundColor: isAdded ? theme.brandTertiary : "#FFF3CD",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: spacing.md,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={isAdded ? "wallet-plus" : "cash-minus"}
                        size={18}
                        color={isAdded ? theme.brandPrimary : "#8A5A00"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "700" }}>
                        {desc}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                        {fmtDate(h.date)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: isAdded ? theme.brandPrimary : "#8A5A00",
                        fontSize: fontSize.lg,
                        fontWeight: "800",
                      }}
                    >
                      {isAdded ? "+" : "-"}
                      {money(h.amount, currency)}
                    </Text>
                  </Card>
                );
              })}
          </>
        ) : null}

        <Body muted style={{ marginTop: spacing.lg, fontSize: fontSize.sm, textAlign: "center" }}>
          Tap any bill or payment to edit or delete it.
        </Body>
      </ScrollView>

      {/* Edit customer */}
      <Modal
        transparent
        animationType="fade"
        visible={editOpen}
        onRequestClose={() => setEditOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setEditOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surfaceSecondary }]}>
            <Text
              style={{
                color: theme.onSurface,
                fontSize: fontSize.xl,
                fontWeight: "800",
                marginBottom: spacing.md,
              }}
            >
              Edit Customer
            </Text>
            <Field
              label="Name"
              value={editName}
              onChangeText={setEditName}
              testID="edit-customer-name"
              autoCapitalize="words"
            />
            <Field
              label="Phone (Optional)"
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              testID="edit-customer-phone"
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => setEditOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                label="Save"
                onPress={saveEdit}
                style={{ flex: 1 }}
                testID="edit-customer-save"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirm */}
      <Modal
        transparent
        animationType="fade"
        visible={confirmDelete}
        onRequestClose={() => setConfirmDelete(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setConfirmDelete(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surfaceSecondary }]}>
            <Text style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800" }}>
              Delete customer?
            </Text>
            <Text style={{ color: theme.muted, fontSize: fontSize.md, marginTop: spacing.sm }}>
              This will remove {customer.name}, their {bills.length} sale
              {bills.length === 1 ? "" : "s"}, and all payments. This cannot be undone.
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => setConfirmDelete(false)}
                style={{ flex: 1 }}
              />
              <Button
                label="Delete"
                variant="danger"
                onPress={doDelete}
                style={{ flex: 1 }}
                testID="confirm-delete-customer"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add entry menu */}
      <Modal
        transparent
        animationType="fade"
        visible={addMenu}
        onRequestClose={() => setAddMenu(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAddMenu(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surfaceSecondary }]}>
            <Text style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800" }}>
              What do you want to add?
            </Text>
            <Body muted style={{ marginTop: spacing.xs }}>
              Manual entries are useful for correcting past records.
            </Body>
            <View style={{ height: spacing.md }} />
            <Button
              label="Purchase / Bill"
              onPress={() => {
                setAddMenu(false);
                setBillEditor({});
              }}
              icon={<Ionicons name="cart-outline" size={18} color="#FFF" />}
              fullWidth
              testID="add-menu-bill"
            />
            <View style={{ height: spacing.sm }} />
            <Button
              label="Payment Received"
              variant="secondary"
              onPress={() => {
                setAddMenu(false);
                setPaymentEditor({});
              }}
              icon={<MaterialCommunityIcons name="cash-plus" size={18} color={theme.onBrandTertiary} />}
              fullWidth
              testID="add-menu-payment"
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bill editor */}
      <BillEditor
        visible={billEditor !== null}
        initial={billEditor}
        customerName={customer.name}
        onDismiss={() => setBillEditor(null)}
        onSave={async (v) => {
          if (billEditor?.id) {
            await updateSale(billEditor.id, {
              date: v.date,
              quantityKg: v.quantityKg,
              pricePerKg: v.pricePerKg,
              initialReceived: v.initialReceived,
            });
            showToast("Bill updated");
          } else {
            await addSale({
              customerName: customer.name,
              phone: customer.phone,
              date: v.date,
              quantityKg: v.quantityKg,
              pricePerKg: v.pricePerKg,
              received: v.initialReceived,
            });
            showToast("Bill added");
          }
        }}
        onDelete={
          billEditor?.id
            ? async () => {
                await deleteSale(billEditor.id!);
                showToast("Bill deleted", "info");
              }
            : undefined
        }
      />

      {/* Payment editor */}
      <PaymentEditor
        visible={paymentEditor !== null}
        initial={paymentEditor}
        customerName={customer.name}
        onDismiss={() => setPaymentEditor(null)}
        onSave={async (v) => {
          if (paymentEditor?.id) {
            await updatePayment(paymentEditor.id, v);
            showToast("Payment updated");
          } else {
            await receivePayment(customer.id, v.amount, v.date);
            showToast("Payment added");
          }
        }}
        onDelete={
          paymentEditor?.id
            ? async () => {
                await deletePayment(paymentEditor.id!);
                showToast("Payment deleted", "info");
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
