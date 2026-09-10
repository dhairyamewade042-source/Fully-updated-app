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

  // Custom date range for the exported statement (defaults to full history).
  const [fromDate, setFromDate] = useState<string>(() => dayjs().format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState<string>(() => dayjs().format("YYYY-MM-DD"));
  const rangeInit = React.useRef(false);
  React.useEffect(() => {
    if (!customer || rangeInit.current) return;
    const ds = [
      ...bills.map((b) => dayjs(b.date).format("YYYY-MM-DD")),
      ...payments.map((p) => dayjs(p.date).format("YYYY-MM-DD")),
    ].sort();
    if (ds.length) {
      setFromDate(ds[0]);
      setToDate(dayjs().format("YYYY-MM-DD"));
    }
    rangeInit.current = true;
  }, [customer, bills, payments]);

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

    // ---- Custom date-range window (inclusive). Empty bound = unbounded. ----
    const from = fromDate || "";
    const to = toDate || "";
    const beforeFrom = (d: string) => (from ? ymd(d) < from : false);
    const afterTo = (d: string) => (to ? ymd(d) > to : false);

    // Opening balance brought forward = net of everything before "from".
    let opening = 0;
    let hasPrior = false;
    events.forEach((e) => {
      if (beforeFrom(e.date)) {
        opening = round2(opening + e.debit - e.credit);
        hasPrior = true;
      }
    });

    const shown = events.filter((e) => !beforeFrom(e.date) && !afterTo(e.date));

    // ---- Running balance + totals over the shown period ----
    let bal = opening;
    let totalDebit = 0;
    let totalCredit = 0;
    const ledgerRows = shown.map((e) => {
      bal = round2(bal + e.debit - e.credit);
      totalDebit = round2(totalDebit + e.debit);
      totalCredit = round2(totalCredit + e.credit);
      return { ...e, balance: bal };
    });
    const closingBalance = round2(opening + totalDebit - totalCredit);

    // ---- Dates / period ----
    const now = dayjs();
    const statementDate = now.format("DD MMM YYYY");
    const generatedOn = now.format("DD MMM YYYY, hh:mm A");
    const periodStart = from || (shown.length ? ymd(shown[0].date) : ymd(now.toISOString()));
    const periodEnd =
      to || (shown.length ? ymd(shown[shown.length - 1].date) : ymd(now.toISOString()));
    const statementPeriod = `${fmtDate(periodStart)} — ${fmtDate(periodEnd)}`;

    // ---- Formatting helpers ----
    const drcr = (n: number) => (n > 0.0001 ? "Dr." : n < -0.0001 ? "Cr." : "");
    const balCell = (n: number) =>
      Math.abs(n) <= 0.0001 ? money(0, currency) : `${money(Math.abs(n), currency)} ${drcr(n)}`;
    const balCls = (n: number) => (n > 0.0001 ? "dr" : n < -0.0001 ? "cr" : "");

    const garlicLogo = `
      <svg viewBox="0 0 64 64" width="40" height="40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M32 5 C34 11 30 13 33 18" stroke="#FFFFFF" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path d="M32 16 C19 16 15 30 15 40 C15 52 23 59 32 59 C41 59 49 52 49 40 C49 30 45 16 32 16 Z" fill="#FFFFFF"/>
        <path d="M32 17 C30 31 30 46 32 58" stroke="#1B5E20" stroke-width="1.6" fill="none"/>
        <path d="M24 20 C21 33 21 47 26 57" stroke="#1B5E20" stroke-width="1.4" fill="none"/>
        <path d="M40 20 C43 33 43 47 38 57" stroke="#1B5E20" stroke-width="1.4" fill="none"/>
      </svg>`;

    // ---- Ledger table (Date | Quantity | Debit | Credit | Balance) ----
    const openingRowHtml = hasPrior
      ? `<tr class="op">
           <td>${fmtDate(periodStart)}</td>
           <td class="c">Opening</td>
           <td class="r mut">—</td>
           <td class="r mut">—</td>
           <td class="bal ${balCls(opening)}">${balCell(opening)}</td>
         </tr>`
      : "";

    const rowsHtml =
      ledgerRows.length === 0
        ? hasPrior
          ? ""
          : `<tr><td class="empty" colspan="5">No transactions in this period.</td></tr>`
        : ledgerRows
            .map(
              (r) => `<tr>
                <td>${fmtDate(r.date)}</td>
                <td class="c">${r.qty ? escapeHtml(r.qty) : "—"}</td>
                <td class="r ${r.debit > 0.0001 ? "dr" : "mut"}">${r.debit > 0.0001 ? money(r.debit, currency) : "—"}</td>
                <td class="r ${r.credit > 0.0001 ? "cr" : "mut"}">${r.credit > 0.0001 ? money(r.credit, currency) : "—"}</td>
                <td class="bal ${balCls(r.balance)}">${balCell(r.balance)}</td>
              </tr>`,
            )
            .join("");

    const totalsRowHtml =
      ledgerRows.length === 0
        ? ""
        : `<tr class="tot">
             <td>TOTAL</td>
             <td class="c"></td>
             <td class="r dr">${money(totalDebit, currency)}</td>
             <td class="r cr">${money(totalCredit, currency)}</td>
             <td class="bal ${balCls(closingBalance)}">${balCell(closingBalance)}</td>
           </tr>`;

    const tableHtml = `
      <style>
        .gh-ledger { width:100%; border-collapse:collapse; table-layout:fixed; margin-top:6px; }
        .gh-ledger th, .gh-ledger td { border:1px solid #B9C9BD; padding:7px 8px; font-size:12px; line-height:1.3; vertical-align:middle; word-break:break-word; }
        .gh-ledger thead th { background:#1B5E20; color:#fff; text-transform:uppercase; letter-spacing:.3px; font-size:11px; font-weight:800; }
        .gh-ledger .r { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
        .gh-ledger .c { text-align:center; }
        .gh-ledger tbody tr:nth-child(even) td { background:#F5F8F5; }
        .gh-ledger .dr { color:#B3261E; font-weight:700; }
        .gh-ledger .cr { color:#1B5E20; font-weight:700; }
        .gh-ledger .mut { color:#8A968C; }
        .gh-ledger .bal { text-align:right; white-space:nowrap; font-weight:800; font-variant-numeric:tabular-nums; }
        .gh-ledger .op td { background:#F0F5F0; font-style:italic; }
        .gh-ledger .tot td { background:#EAF3EC; font-weight:800; border-top:2px solid #1B5E20; }
        .gh-ledger .empty { text-align:center; font-style:italic; color:#66736A; padding:16px; }
        .gh-ledger tr { page-break-inside:avoid; }
      </style>
      <table class="gh-ledger">
        <colgroup>
          <col style="width:17%"/><col style="width:18%"/><col style="width:20%"/><col style="width:20%"/><col style="width:25%"/>
        </colgroup>
        <thead>
          <tr>
            <th>Date</th>
            <th class="c">Quantity</th>
            <th class="r">Debit</th>
            <th class="r">Credit</th>
            <th class="r">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${openingRowHtml}
          ${rowsHtml}
          ${totalsRowHtml}
        </tbody>
      </table>`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * {
          box-sizing: border-box;
        }

        /* Professional A4 bank-statement page */
        @page {
          size: A4 portrait;
          margin: 9mm 8mm 9mm 8mm;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          width: 100%;
          background: #ffffff;
        }

        body {
          font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
          color: #1E2B22;
          font-size: 11px;
          line-height: 1.35;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .sheet {
          width: 100%;
          max-width: none;
          margin: 0;
        }

        /* =========================================================
           PROFESSIONAL LETTERHEAD
           ========================================================= */

        .letterhead {
          position: relative;
          text-align: center;
          padding: 0 0 8px;
          border-bottom: 2px solid #1B5E20;
        }

        .badge-logo {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #1B5E20;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 3px;
        }

        .biz-name {
          font-size: 21px;
          font-weight: 800;
          color: #1B5E20;
          letter-spacing: 1.4px;
        }

        .biz-tag {
          font-size: 10px;
          color: #59665D;
          letter-spacing: .25px;
          margin-top: 1px;
        }

        .biz-contact {
          font-size: 9px;
          color: #59665D;
          margin-top: 3px;
          line-height: 1.35;
        }

        .biz-contact span {
          display: block;
        }

        /* =========================================================
           DOCUMENT TITLE
           ========================================================= */

        .doc-title {
          text-align: center;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: #1B5E20;
          background: #EEF5EF;
          border: 1px solid #D5E3D7;
          padding: 6px 0;
          margin: 9px 0 9px;
          border-radius: 2px;
        }

        /* =========================================================
           CUSTOMER + SUMMARY
           ========================================================= */

        .cols {
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-bottom: 9px;
        }

        .block {
          border: 1px solid #CBD8CE;
          border-radius: 3px;
          overflow: hidden;
          page-break-inside: avoid;
        }

        .block .bhead {
          background: #1B5E20;
          color: #FFFFFF;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .7px;
          text-transform: uppercase;
          padding: 5px 8px;
        }

        .block .bbody {
          padding: 5px 8px;
          background: #FFFFFF;
        }

        .kv {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 2px 0;
          font-size: 10px;
          min-height: 17px;
        }

        .kv .k {
          color: #657168;
        }

        .kv .v {
          font-weight: 700;
          color: #1E2B22;
          text-align: right;
        }

        .kv .v.dr {
          color: #B3261E;
        }

        .kv .v.cr {
          color: #1B5E20;
        }

        .summary .bbody {
          background: #F7F9F7;
        }

        /* =========================================================
           LEDGER TABLE
           KEEPING YOUR EXISTING 6 COLUMNS
           
           1 Date
           2 Type/Qty
           3 Debit
           4 Credit
           5 Dr/Cr
           6 Balance
           ========================================================= */

        table.ledger {
          width: 100%;
          border-collapse: collapse;
          border-spacing: 0;
          table-layout: fixed;
          margin-top: 4px;
          page-break-before: auto;
        }

        table.ledger thead {
          display: table-header-group;
        }

        table.ledger thead th {
          background: #1B5E20;
          color: #FFFFFF;
          font-size: 8.8px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .25px;
          padding: 6px 5px;
          border: 1px solid #145018;
          text-align: left;
          vertical-align: middle;
          white-space: nowrap;
        }

        /* Same 6-column ledger structure, better proportions for A4 */

        table.ledger th:nth-child(1),
        table.ledger td:nth-child(1) {
          width: 14%;
        }

        table.ledger th:nth-child(2),
        table.ledger td:nth-child(2) {
          width: 12%;
          text-align: center;
        }

        table.ledger th:nth-child(3),
        table.ledger td:nth-child(3) {
          width: 17%;
        }

        table.ledger th:nth-child(4),
        table.ledger td:nth-child(4) {
          width: 17%;
        }

        table.ledger th:nth-child(5),
        table.ledger td:nth-child(5) {
          width: 10%;
          text-align: center;
        }

        table.ledger th:nth-child(6),
        table.ledger td:nth-child(6) {
          width: 30%;
        }

        table.ledger tbody td {
          padding: 6px 5px;
          border: 1px solid #D1DBD3;
          font-size: 10px;
          line-height: 1.25;
          vertical-align: middle;
          word-break: normal;
          overflow-wrap: anywhere;
          background: #FFFFFF;
        }

        /* Very subtle alternating rows like financial statements */
        table.ledger tbody tr:nth-child(even) td {
          background: #F8FAF8;
        }

        /* Numeric columns */
        table.ledger .num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        table.ledger th.num {
          text-align: right;
        }

        table.ledger .c-qty,
        table.ledger th.c-qty {
          text-align: center;
          white-space: nowrap;
        }

        table.ledger .c-drcr,
        table.ledger th.c-drcr {
          text-align: center;
          white-space: nowrap;
          font-weight: 800;
        }

        /* Debit = red */
        table.ledger tbody td.c-debit {
          color: #B3261E;
          font-weight: 700;
        }

        /* Credit = green */
        table.ledger tbody td.c-credit {
          color: #1B5E20;
          font-weight: 700;
        }

        table.ledger .muted {
          color: #7B877E;
        }

        table.ledger .cc-dr {
          color: #B3261E;
          font-weight: 800;
        }

        table.ledger .cc-cr {
          color: #1B5E20;
          font-weight: 800;
        }

        /* Closing balance */
        table.ledger .c-bal {
          font-weight: 800;
          white-space: nowrap;
        }

        table.ledger td.bal-dr {
          color: #B3261E;
        }

        table.ledger td.bal-cr {
          color: #1B5E20;
        }

        /* Keep transaction rows together */
        table.ledger tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .empty {
          text-align: center;
          color: #66736A;
          font-style: italic;
          padding: 12px 6px !important;
        }

        /* =========================================================
           TOTAL ROW — BANK STATEMENT STYLE
           ========================================================= */

        table.ledger tr.totals td {
          background: #EAF3EC;
          font-weight: 800;
          border-top: 2px solid #1B5E20;
          border-bottom: 1px solid #AFC5B4;
          font-size: 10px;
          padding: 7px 5px;
        }

        /* =========================================================
           FOOTER
           ========================================================= */

        .foot {
          margin-top: 11px;
          padding-top: 7px;
          border-top: 1px solid #1B5E20;
          text-align: center;
          color: #59665D;
          font-size: 8.5px;
          line-height: 1.4;
          page-break-inside: avoid;
        }

        .foot .biz {
          font-weight: 700;
          color: #1B5E20;
          letter-spacing: .25px;
        }

        .foot .thanks {
          margin-top: 3px;
          font-weight: 700;
          color: #1B5E20;
        }
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
                <div class="kv"><span class="k">Name</span><span class="v">${escapeHtml(customer!.name)}${customer!.hindiName ? ` (${escapeHtml(customer!.hindiName)})` : ""}</span></div>
                <div class="kv"><span class="k">Phone</span><span class="v">${customer!.phone ? escapeHtml(customer!.phone) : "—"}</span></div>
                <div class="kv"><span class="k">Statement Date</span><span class="v">${statementDate}</span></div>
                <div class="kv"><span class="k">Statement Period</span><span class="v">${statementPeriod}</span></div>
              </div>
            </div>
            <div class="block summary">
              <div class="bhead">Summary</div>
              <div class="bbody">
                <div class="kv"><span class="k">Total Debit</span><span class="v dr">${money(totalDebit, currency)}</span></div>
                <div class="kv"><span class="k">Total Credit</span><span class="v cr">${money(totalCredit, currency)}</span></div>
                <div class="kv"><span class="k">Closing Balance</span><span class="v ${closingBalance > 0.0001 ? "dr" : closingBalance < -0.0001 ? "cr" : ""}">${balCell(closingBalance)}</span></div>
              </div>
            </div>
          </div>

          ${tableHtml}

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

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Label>From</Label>
            <DateField label="" value={fromDate} onChange={setFromDate} testID="statement-from-date" />
          </View>
          <View style={{ flex: 1 }}>
            <Label>To</Label>
            <DateField label="" value={toDate} onChange={setToDate} testID="statement-to-date" />
          </View>
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
