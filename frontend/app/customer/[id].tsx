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
    // ---- Business identity (letterhead) ----
    const BIZ = {
      name: "GARLIC HUB",
      tagline: "Garlic Supplier & Packaging",
      phone: "+91 7509730965",
      address: "Bercha Road, Dusherra Maidan, Shajapur",
    };
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const ymd = (s: string) => dayjs(s).format("YYYY-MM-DD");

    // ---- Build ONE chronological ledger from actual data ----
    // Each sale => a Debit (bill) line; any cash paid on that bill day => a Credit line.
    // Each payment => a Credit line. Running balance = prev + debit - credit.
    type Row = {
      date: string;
      created: string;
      particulars: string;
      qty: string;
      debit: number;
      credit: number;
    };
    const events: Row[] = [];
    bills.forEach((b) => {
      events.push({
        date: b.date,
        created: b.createdAt || b.date,
        particulars: "Garlic",
        qty: b.quantityKg ? `${b.quantityKg} KG` : "",
        debit: round2(b.total),
        credit: 0,
      });
      if ((b.initialReceived || 0) > 0.0001) {
        events.push({
          date: b.date,
          created: b.createdAt || b.date,
          particulars: "Payment Received (on bill)",
          qty: "",
          debit: 0,
          credit: round2(b.initialReceived),
        });
      }
    });
    payments.forEach((p) => {
      events.push({
        date: p.date,
        created: p.createdAt || p.date,
        particulars: "Payment Received",
        qty: "",
        debit: 0,
        credit: round2(p.amount),
      });
    });
    events.sort(
      (a, b) =>
        ymd(a.date).localeCompare(ymd(b.date)) ||
        String(a.created).localeCompare(String(b.created)),
    );

    // ---- Running balance + totals (nothing hard-coded) ----
    const openingBalance = 0; // statement covers full history
    let bal = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;
    const ledgerRows = events.map((e) => {
      bal = round2(bal + e.debit - e.credit);
      totalDebit = round2(totalDebit + e.debit);
      totalCredit = round2(totalCredit + e.credit);
      return { ...e, balance: bal };
    });
    totalDebit = round2(totalDebit);
    totalCredit = round2(totalCredit);
    const closingBalance = round2(openingBalance + totalDebit - totalCredit);

    // ---- Dates / period ----
    const now = dayjs();
    const statementDate = now.format("DD MMM YYYY");
    const generatedOn = now.format("DD MMM YYYY, hh:mm A");
    const firstDate = events.length ? events[0].date : now.toISOString();
    const lastDate = events.length ? events[events.length - 1].date : now.toISOString();
    const statementPeriod = `${fmtDate(firstDate)} — ${fmtDate(lastDate)}`;

    // ---- Formatting helpers ----
    const drcr = (n: number) => (n > 0.0001 ? "Dr." : n < -0.0001 ? "Cr." : "—");
    const balCell = (n: number) =>
      Math.abs(n) <= 0.0001 ? money(0, currency) : `${money(Math.abs(n), currency)} ${drcr(n)}`;
    const amt = (n: number) => (n > 0.0001 ? money(n, currency) : "—");

    const garlicLogo = `
      <svg viewBox="0 0 64 64" width="40" height="40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M32 5 C34 11 30 13 33 18" stroke="#FFFFFF" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path d="M32 16 C19 16 15 30 15 40 C15 52 23 59 32 59 C41 59 49 52 49 40 C49 30 45 16 32 16 Z" fill="#FFFFFF"/>
        <path d="M32 17 C30 31 30 46 32 58" stroke="#1B5E20" stroke-width="1.6" fill="none"/>
        <path d="M24 20 C21 33 21 47 26 57" stroke="#1B5E20" stroke-width="1.4" fill="none"/>
        <path d="M40 20 C43 33 43 47 38 57" stroke="#1B5E20" stroke-width="1.4" fill="none"/>
      </svg>`;

    const balClass = (n: number) =>
      n > 0.0001 ? "bal-dr" : n < -0.0001 ? "bal-cr" : "";

    const rowsHtml =
      ledgerRows.length === 0
        ? `<tr><td colspan="6" class="empty">No transactions in this period.</td></tr>`
        : ledgerRows
            .map((r) => {
              const isCredit = r.credit > 0.0001;
              const debitCell =
                r.debit > 0.0001
                  ? `<td class="num c-debit">${money(r.debit, currency)}</td>`
                  : `<td class="num muted">—</td>`;
              const creditCell =
                r.credit > 0.0001
                  ? `<td class="num c-credit">${money(r.credit, currency)}</td>`
                  : `<td class="num muted">—</td>`;
              return `<tr>
                <td class="c-date">${fmtDate(r.date)}</td>
                <td class="c-qty">${r.qty ? escapeHtml(r.qty) : "—"}</td>
                ${debitCell}
                ${creditCell}
                <td class="c-drcr ${isCredit ? "cc-cr" : "cc-dr"}">${isCredit ? "Cr." : "Dr."}</td>
                <td class="num c-bal ${balClass(r.balance)}">${balCell(r.balance)}</td>
              </tr>`;
            })
            .join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: 100mm 170mm; margin: 6mm 5mm 7mm 5mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
          font-family: "Helvetica Neue", Helvetica, Arial, "Segoe UI", Roboto, sans-serif;
          color: #1E2B22; font-size: 10px; line-height: 1.4;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .sheet { width: 100%; margin: 0 auto; }

        /* Letterhead */
        .letterhead { text-align: center; padding-bottom: 8px; border-bottom: 2px solid #1B5E20; }
        .badge-logo {
          width: 42px; height: 42px; border-radius: 50%; background: #1B5E20;
          display: inline-flex; align-items: center; justify-content: center; margin-bottom: 4px;
        }
        .biz-name { font-size: 19px; font-weight: 800; color: #1B5E20; letter-spacing: 1.5px; }
        .biz-tag { font-size: 10px; color: #4B5A4F; letter-spacing: .3px; margin-top: 1px; }
        .biz-contact { font-size: 9px; color: #4B5A4F; margin-top: 4px; line-height: 1.5; }
        .biz-contact span { display: block; }

        .doc-title {
          text-align: center; font-size: 10px; font-weight: 700; letter-spacing: 2px;
          text-transform: uppercase; color: #1B5E20; background: #EAF3EC;
          padding: 4px 0; margin: 10px 0 10px; border-radius: 4px;
        }

        /* Customer + summary blocks (stacked for mobile) */
        .cols { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .block { border: 1px solid #D6E2D9; border-radius: 6px; overflow: hidden; }
        .block .bhead {
          background: #1B5E20; color: #fff; font-size: 9px; font-weight: 700;
          letter-spacing: .8px; text-transform: uppercase; padding: 5px 8px;
        }
        .block .bbody { padding: 6px 8px; background: #fff; }
        .kv { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
        .kv .k { color: #5C6B5F; }
        .kv .v { font-weight: 700; color: #1E2B22; text-align: right; }
        .kv .v.dr { color: #B3261E; }
        .kv .v.cr { color: #1B5E20; }
        .summary .bbody { background: #F5F8F5; }

        /* Ledger table */
        table.ledger { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.ledger thead th {
          background: #1B5E20; color: #fff; font-size: 8.5px; font-weight: 700;
          text-transform: uppercase; letter-spacing: .2px; padding: 5px 4px;
          border: 1px solid #145018; text-align: left;
        }
        table.ledger tbody td {
          padding: 5px 4px; border: 1px solid #D6E2D9; font-size: 9px; vertical-align: top;
          word-break: break-word;
        }
        table.ledger tbody tr:nth-child(even) td { background: #F5F8F5; }
        table.ledger .num { text-align: right; font-variant-numeric: tabular-nums; }
        table.ledger th.num { text-align: right; }
        table.ledger .c-qty, table.ledger th.c-qty { text-align: center; }
        table.ledger .c-drcr, table.ledger th.c-drcr { text-align: center; font-weight: 700; }
        table.ledger tbody td.c-debit { color: #B3261E; font-weight: 800; }
        table.ledger tbody td.c-credit { color: #1B5E20; font-weight: 800; }
        table.ledger .muted { color: #9AA79E; }
        table.ledger .cc-dr { color: #B3261E; }
        table.ledger .cc-cr { color: #1B5E20; }
        table.ledger .c-bal { font-weight: 800; }
        table.ledger td.bal-dr { color: #B3261E; }
        table.ledger td.bal-cr { color: #1B5E20; }
        table.ledger tr { page-break-inside: avoid; }
        .empty { text-align: center; color: #5C6B5F; font-style: italic; padding: 12px 6px !important; }
        table.ledger tr.totals td {
          background: #EAF3EC; font-weight: 800; border-top: 2px solid #1B5E20; font-size: 9.5px;
        }

        /* Footer */
        .foot {
          margin-top: 14px; padding-top: 8px; border-top: 1.5px solid #1B5E20;
          text-align: center; color: #4B5A4F; font-size: 8.5px; line-height: 1.5;
        }
        .foot .biz { font-weight: 700; color: #1B5E20; letter-spacing: .3px; }
        .foot .thanks { margin-top: 4px; font-weight: 700; color: #1B5E20; }
      </style></head>
      <body>
        <div class="sheet">
          <div class="letterhead">
            <div class="badge-logo">${garlicLogo}</div>
            <div class="biz-name">${escapeHtml(BIZ.name)}</div>
            <div class="biz-tag">${escapeHtml(BIZ.tagline)}</div>
            <div class="biz-contact"><span>📞 ${escapeHtml(BIZ.phone)}</span><span>📍 ${escapeHtml(BIZ.address)}</span></div>
          </div>

          <div class="doc-title">Customer Ledger Statement</div>

          <div class="cols">
            <div class="block">
              <div class="bhead">Customer Details</div>
              <div class="bbody">
                <div class="kv"><span class="k">Name</span><span class="v">${escapeHtml(customer!.name)}</span></div>
                <div class="kv"><span class="k">Phone</span><span class="v">${customer!.phone ? escapeHtml(customer!.phone) : "—"}</span></div>
                <div class="kv"><span class="k">Statement Date</span><span class="v">${statementDate}</span></div>
                <div class="kv"><span class="k">Statement Period</span><span class="v">${statementPeriod}</span></div>
              </div>
            </div>
            <div class="block summary">
              <div class="bhead">Account Summary</div>
              <div class="bbody">
                <div class="kv"><span class="k">Opening Balance</span><span class="v">${balCell(openingBalance)}</span></div>
                <div class="kv"><span class="k">Total Debit</span><span class="v dr">${money(totalDebit, currency)}</span></div>
                <div class="kv"><span class="k">Total Credit</span><span class="v cr">${money(totalCredit, currency)}</span></div>
                <div class="kv"><span class="k">Closing Balance</span><span class="v ${closingBalance > 0.0001 ? "dr" : closingBalance < -0.0001 ? "cr" : ""}">${balCell(closingBalance)}</span></div>
              </div>
            </div>
          </div>

          <table class="ledger">
            <colgroup>
              <col style="width:18%" />
              <col style="width:13%" />
              <col style="width:18%" />
              <col style="width:18%" />
              <col style="width:13%" />
              <col style="width:20%" />
            </colgroup>
            <thead>
              <tr>
                <th class="c-date">Date</th>
                <th class="c-qty">Quantity</th>
                <th class="num">Debit</th>
                <th class="num">Credit</th>
                <th class="c-drcr">Dr./Cr.</th>
                <th class="num c-bal">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              ${
                ledgerRows.length === 0
                  ? ""
                  : `<tr class="totals">
                      <td colspan="2">TOTAL</td>
                      <td class="num c-debit">${money(totalDebit, currency)}</td>
                      <td class="num c-credit">${money(totalCredit, currency)}</td>
                      <td class="c-drcr ${closingBalance > 0.0001 ? "cc-dr" : closingBalance < -0.0001 ? "cc-cr" : ""}">${drcr(closingBalance)}</td>
                      <td class="num c-bal ${closingBalance > 0.0001 ? "bal-dr" : closingBalance < -0.0001 ? "bal-cr" : ""}">${balCell(closingBalance)}</td>
                    </tr>`
              }
            </tbody>
          </table>

          <div class="foot">
            <div class="biz">${escapeHtml(BIZ.name)} | ${escapeHtml(BIZ.phone)} | ${escapeHtml(BIZ.address)}</div>
            <div>Statement generated on ${generatedOn}</div>
            <div class="thanks">Thank you for your business!</div>
          </div>
        </div>
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
