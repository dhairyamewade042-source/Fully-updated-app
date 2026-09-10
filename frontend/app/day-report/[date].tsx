// Day Report — customer sales for a chosen date (no supplier/purchases).
// Shows each customer's quantity, bill total, received, pending and status,
// and exports a professional A4 "Customer Report" PDF in English or Hindi
// (Hindi transliterates only the customer names into Devanagari).

import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateField } from "@/src/components/DateField";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Badge, Body, Button, Card, H2, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fmtDate, kg, money } from "@/src/lib/format";
import { exportHtmlAsPdf } from "@/src/lib/pdf";
import { fontSize, spacing } from "@/src/lib/theme";
import { toHindiName } from "@/src/lib/translit";
import { Sale } from "@/src/lib/types";

const ymd = (s: string) => dayjs(s).format("YYYY-MM-DD");
const round2 = (n: number) => Math.round(n * 100) / 100;

const BIZ = {
  name: "WHITE GARLIC",
  phone: "+91 7509730965",
  address: "Bercha Road, Dusherra Maidan, Shajapur",
};

export default function DayReportScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const { theme, data } = useApp();
  const insets = useSafeAreaInsets();
  const currency = data.settings.currency;

  const [date, setDate] = useState<string>(
    params.date ? ymd(String(params.date)) : dayjs().format("YYYY-MM-DD"),
  );
  const [exporting, setExporting] = useState<null | "en" | "hi">(null);

  const report = useMemo(() => {
    const sales = data.sales
      .filter((s) => ymd(s.date) === date)
      // Preserve the order customers FIRST appear in sales created that day
      // (chronological by creation), so the report is never alphabetical.
      .sort((a, b) => (a.createdAt || a.date).localeCompare(b.createdAt || b.date));

    // Aggregate customer-wise (one row per customer) for the report.
    const byCust = new Map<
      string,
      { id: string; name: string; hindiName?: string; qty: number; total: number; received: number; pending: number; advance: number }
    >();
    sales.forEach((s) => {
      const g =
        byCust.get(s.customerId) ||
        { id: s.customerId, name: s.customerName, hindiName: data.customers.find((c) => c.id === s.customerId)?.hindiName, qty: 0, total: 0, received: 0, pending: 0, advance: 0 };
      g.qty = round2(g.qty + s.quantityKg);
      g.total = round2(g.total + s.total);
      g.received = round2(g.received + s.received);
      g.pending = round2(g.pending + Math.max(0, s.total - s.received));
      byCust.set(s.customerId, g);
    });

    /*
     * Running customer advance as of the selected date.
     *
     * Advance = all money received up to this date
     *           minus all bills up to this date.
     *
     * A sale's initialReceived is money received on that bill.
     * Separate Payment records are later payments/advances.
     *
     * This gives:
     * Previous pending 20 + today's bill 120, payment 150 = advance 10.
     * Next day: previous advance 10 + payment 150 - bill 120 = advance 40.
     */
    byCust.forEach((g) => {
      const customerSales = data.sales.filter(
        (s) =>
          s.customerId === g.id &&
          ymd(s.date) <= date
      );

      const customerPayments = data.payments.filter(
        (p) =>
          p.customerId === g.id &&
          ymd(p.date) <= date
      );

      const totalBills = customerSales.reduce(
        (sum, s) => sum + Number(s.total || 0),
        0
      );

      const billPayments = customerSales.reduce(
        (sum, s) => sum + Number(s.initialReceived || 0),
        0
      );

      const laterPayments = customerPayments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      );

      g.advance = round2(
        Math.max(0, billPayments + laterPayments - totalBills)
      );
    });

    // Advance balance at the END of this report day.
    // This includes advance carried from previous days.
    // Formula:
    // total payments received up to this day
    // minus total bills up to this day, never below zero.
    const customerRows = Array.from(byCust.values()).map((row) => {
      const historicalSales = data.sales
        .filter(
          (x) =>
            x.customerId === row.id &&
            ymd(x.date) <= date,
        )
        .reduce((sum, x) => sum + x.total, 0);

      const historicalInitialReceived = data.sales
        .filter(
          (x) =>
            x.customerId === row.id &&
            ymd(x.date) <= date,
        )
        .reduce((sum, x) => sum + (x.initialReceived || 0), 0);

      const historicalPayments = data.payments
        .filter(
          (p) =>
            p.customerId === row.id &&
            ymd(p.date) <= date,
        )
        .reduce((sum, p) => sum + p.amount, 0);

      const advance = round2(
        Math.max(
          0,
          historicalInitialReceived +
            historicalPayments -
            historicalSales,
        ),
      );

      return {
        ...row,
        advance,
      };
    });

    const totalSales = round2(sales.reduce((a, s) => a + s.total, 0));
    const totalQty = round2(sales.reduce((a, s) => a + s.quantityKg, 0));
    const totalReceived = round2(sales.reduce((a, s) => a + s.received, 0));
    const totalPending = round2(sales.reduce((a, s) => a + Math.max(0, s.total - s.received), 0));

    return {
      sales,
      customerRows,
      totalSales,
      totalQty,
      totalReceived,
      totalPending,
      customerCount: customerRows.length,
    };
  }, [data, date]);

  const dateLabel = fmtDate(date);

  const buildCustomerReportHtml = (lang: "en" | "hi"): string => {
    const generatedOn = dayjs().format("DD MMM YYYY, hh:mm A");

    const garlicLogo = `
      <svg viewBox="0 0 64 64" width="34" height="34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M32 5 C34 11 30 13 33 18" stroke="#FFFFFF" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path d="M32 16 C19 16 15 30 15 40 C15 52 23 59 32 59 C41 59 49 52 49 40 C49 30 45 16 32 16 Z" fill="#FFFFFF"/>
        <path d="M32 17 C30 31 30 46 32 58" stroke="#1B5E20" stroke-width="1.6" fill="none"/>
        <path d="M24 20 C21 33 21 47 26 57" stroke="#1B5E20" stroke-width="1.4" fill="none"/>
        <path d="M40 20 C43 33 43 47 38 57" stroke="#1B5E20" stroke-width="1.4" fill="none"/>
      </svg>`;

    const rows =
      report.customerRows.length === 0
        ? `<tr><td colspan="7" class="empty">No customer transactions on this day.</td></tr>`
        : report.customerRows
            .map((r, i) => {
              const displayName = lang === "hi" ? (r.hindiName || toHindiName(r.name)) : r.name;
              return `<tr>
                <td class="c-idx">${i + 1}</td>
                <td class="c-name">${escapeHtml(displayName)}</td>
                <td class="num">${kg(r.qty)}</td>
                <td class="num">${money(r.total, currency)}</td>
                <td class="num c-recv">${money(r.received, currency)}</td>
                <td class="num c-pend">${money(r.pending, currency)}</td>
                <td class="num c-status">${money(r.advance, currency)}</td>
              </tr>`;
            })
            .join("");

    return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
          font-family: "Helvetica Neue", Helvetica, Arial, "Segoe UI", Roboto,
            "Noto Sans Devanagari", "Mangal", sans-serif;
          color: #1E2B22; font-size: 13px; line-height: 1.5;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .wrap { width: 100%; }

        .letterhead { text-align: center; padding-bottom: 12px; border-bottom: 2.5px solid #1B5E20; }
        .badge-logo {
          width: 48px; height: 48px; border-radius: 50%; background: #1B5E20;
          display: inline-flex; align-items: center; justify-content: center; margin-bottom: 6px;
        }
        .biz-name { font-size: 24px; font-weight: 800; color: #1B5E20; letter-spacing: 1.5px; }
        .biz-contact { font-size: 12px; color: #4B5A4F; margin-top: 4px; line-height: 1.55; }

        .title-row {
          display: flex; justify-content: space-between; align-items: baseline;
          margin: 16px 0 12px;
        }
        .doc-title { font-size: 15px; font-weight: 800; color: #1B5E20; letter-spacing: 1px; text-transform: uppercase; }
        .doc-date { font-size: 14px; font-weight: 700; color: #1E2B22; }

        .cards { display: flex; gap: 12px; margin-bottom: 16px; }
        .stat { flex: 1; border: 1px solid #D6E2D9; border-radius: 8px; padding: 12px 14px; background: #F5F8F5; }
        .stat .l { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #5C6B5F; font-weight: 700; }
        .stat .v { font-size: 20px; font-weight: 800; margin-top: 4px; }
        .stat.sales .v { color: #1E2B22; }
        .stat.recv .v { color: #1B5E20; }
        .stat.pend .v { color: #B3261E; }

        table { width: 100%; border-collapse: collapse; }
        thead th {
          background: #1B5E20; color: #fff; font-size: 12px; font-weight: 700;
          text-transform: uppercase; letter-spacing: .3px; padding: 9px 10px;
          border: 1px solid #145018; text-align: left;
        }
        tbody td { padding: 9px 10px; border: 1px solid #D6E2D9; font-size: 13px; vertical-align: middle; }
        tbody tr:nth-child(even) td { background: #F5F8F5; }
        .num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .c-idx, th.c-idx { text-align: center; width: 6%; }
        .c-status, th.c-status { text-align: center; width: 12%; }
        .c-name { font-weight: 700; }
        .c-recv { color: #1B5E20; font-weight: 700; }
        .c-pend { color: #B3261E; font-weight: 700; }
        .empty { text-align: center; color: #5C6B5F; font-style: italic; padding: 18px 10px !important; }
        tr { page-break-inside: avoid; }
        tr.totals td {
          background: #EAF3EC; font-weight: 800; border-top: 2px solid #1B5E20; font-size: 13.5px;
        }
        tr.totals .c-recv { color: #1B5E20; }
        tr.totals .c-pend { color: #B3261E; }

        .foot {
          margin-top: 20px; padding-top: 12px; border-top: 1.5px solid #1B5E20;
          text-align: center; color: #4B5A4F; font-size: 11px; line-height: 1.6;
          page-break-inside: avoid;
        }
        .foot .biz { font-weight: 700; color: #1B5E20; letter-spacing: .3px; }
        .foot .thanks { margin-top: 4px; font-weight: 700; color: #1B5E20; }
      </style></head>
      <body>
        <div class="wrap">
          <div class="letterhead">
            <div class="badge-logo">${garlicLogo}</div>
            <div class="biz-name">${escapeHtml(BIZ.name)}</div>
            <div class="biz-contact">${escapeHtml(BIZ.phone)}<br/>${escapeHtml(BIZ.address)}</div>
          </div>

          <div class="title-row">
            <div class="doc-title">Customer Day Report</div>
            <div class="doc-date">${dateLabel}</div>
          </div>

          <div class="cards">
            <div class="stat sales"><div class="l">Total Sales</div><div class="v">${money(report.totalSales, currency)}</div></div>
            <div class="stat recv"><div class="l">Total Received</div><div class="v">${money(report.totalReceived, currency)}</div></div>
            <div class="stat pend"><div class="l">Total Pending</div><div class="v">${money(report.totalPending, currency)}</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="c-idx">#</th>
                <th>Customer</th>
                <th class="num">Quantity</th>
                <th class="num">Total</th>
                <th class="num">Received</th>
                <th class="num">Pending</th>
                <th class="c-status">Advance Payment</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              ${
                report.customerRows.length === 0
                  ? ""
                  : `<tr class="totals">
                      <td></td>
                      <td>TOTAL</td>
                      <td class="num">${kg(report.totalQty)}</td>
                      <td class="num">${money(report.totalSales, currency)}</td>
                      <td class="num c-recv">${money(report.totalReceived, currency)}</td>
                      <td class="num c-pend">${money(report.totalPending, currency)}</td>
                      <td></td>
                    </tr>`
              }
            </tbody>
          </table>

          <div class="foot">
            <div class="biz">${escapeHtml(BIZ.name)} | ${escapeHtml(BIZ.phone)} | ${escapeHtml(BIZ.address)}</div>
            <div>Report generated on ${generatedOn}</div>
            <div class="thanks">Thank you for your business!</div>
          </div>
        </div>
      </body></html>`;
  };

  const onExport = async (lang: "en" | "hi") => {
    if (exporting) return;
    setExporting(lang);
    try {
      await exportHtmlAsPdf(
        buildCustomerReportHtml(lang),
        `Sales Report ${fmtDate(date)}`,
      );
    } finally {
      setExporting(null);
    }
  };

  const Stat = ({ label, value, tone }: { label: string; value: string; tone?: "pending" }) => (
    <Card style={{ flexGrow: 1, flexBasis: "30%", minWidth: 140, padding: spacing.md }}>
      <Label>{label}</Label>
      <Text
        style={{
          color: tone === "pending" && report.totalPending > 0 ? theme.error : theme.onSurface,
          fontSize: fontSize.xl,
          fontWeight: "800",
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }} testID="day-report-screen">
      <ScreenHeader title="Day Report" subtitle={dateLabel} showBack />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 180 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Label>Report Date</Label>
        <View style={{ marginTop: spacing.sm }}>
          <DateField label="" value={date} onChange={setDate} testID="day-report-date" />
        </View>

        {/* Customer summary */}
        <View style={styles.grid}>
          <Stat label="Total Sales" value={money(report.totalSales, currency)} />
          <Stat label="Quantity" value={kg(report.totalQty)} />
          <Stat label="Customers" value={String(report.customerCount)} />
          <Stat label="Received" value={money(report.totalReceived, currency)} />
          <Stat label="Pending" value={money(report.totalPending, currency)} tone="pending" />
        </View>

        {/* Customers list */}
        <H2 style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Customers</H2>
        {report.customerRows.length === 0 ? (
          <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <MaterialCommunityIcons
              name="cart-off"
              size={30}
              color={theme.muted}
              style={{ marginBottom: spacing.sm }}
            />
            <Body muted>No customer sales on this day</Body>
          </Card>
        ) : (
          report.customerRows.map((r) => {
            return (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/customer/${r.id}`)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.85 : 1,
                  marginBottom: spacing.sm,
                })}
                testID={`day-report-customer-${r.id}`}
              >
                <Card>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "700" }}>
                      {r.name}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                      {kg(r.qty)}
                    </Text>
                  </View>
                  
                </View>
                <View style={styles.billRow}>
                  <View style={{ flex: 1 }}>
                    <Label>Total</Label>
                    <Text style={styles.billVal}>{money(r.total, currency)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label>Received</Label>
                    <Text style={[styles.billVal, { color: theme.brandPrimary }]}>
                      {money(r.received, currency)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label>Pending</Label>
                    <Text style={[styles.billVal, { color: r.pending > 0 ? theme.error : theme.onSurface }]}>
                      {money(r.pending, currency)}
                    </Text>
                  </View>
                </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Sticky export buttons */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.divider,
          gap: spacing.sm,
        }}
      >
        <Button
          label="Export PDF — English"
          onPress={() => onExport("en")}
          loading={exporting === "en"}
          disabled={!!exporting}
          fullWidth
          testID="day-report-export-en"
          icon={<MaterialCommunityIcons name="file-pdf-box" size={22} color={theme.onBrandPrimary} />}
        />
        <Button
          label="Export PDF — Hindi"
          onPress={() => onExport("hi")}
          loading={exporting === "hi"}
          disabled={!!exporting}
          variant="secondary"
          fullWidth
          testID="day-report-export-hi"
          icon={<MaterialCommunityIcons name="file-pdf-box" size={22} color={theme.onBrandTertiary} />}
        />
      </View>
    </View>
  );
}

const escapeHtml = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  billRow: {
    flexDirection: "row",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    gap: spacing.md,
  },
  billVal: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    marginTop: 2,
  },
});
