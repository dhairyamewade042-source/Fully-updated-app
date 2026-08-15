// Full day report — every bill/customer for a chosen date with status,
// plus payments collected and purchases that day, and a PDF statement export.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateField } from "@/src/components/DateField";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Badge, Body, Button, Card, H2, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fmtDate, kg, money } from "@/src/lib/format";
import { exportHtmlAsPdf } from "@/src/lib/pdf";
import { fontSize, radius, spacing } from "@/src/lib/theme";
import { Payment, Sale } from "@/src/lib/types";

const ymd = (s: string) => dayjs(s).format("YYYY-MM-DD");

type Status = "Paid" | "Partial" | "Unpaid";
const statusOf = (s: Sale): Status => {
  const pending = s.total - s.received;
  if (pending <= 0.0001) return "Paid";
  if (s.received <= 0.0001) return "Unpaid";
  return "Partial";
};
const toneOf = (st: Status): "success" | "warning" | "error" =>
  st === "Paid" ? "success" : st === "Partial" ? "warning" : "error";

export default function DayReportScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const { theme, data, getCustomer, customerAdvance, customerAdvanceHistory } = useApp();
  const insets = useSafeAreaInsets();
  const currency = data.settings.currency;

  const [date, setDate] = useState<string>(
    params.date ? ymd(String(params.date)) : dayjs().format("YYYY-MM-DD"),
  );
  const [exporting, setExporting] = useState(false);

  const report = useMemo(() => {
    const sales = data.sales
      .filter((s) => ymd(s.date) === date)
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
    const payments = data.payments.filter((p) => ymd(p.date) === date);
    const purchases = data.traderBills.filter((b) => ymd(b.date) === date);

    const totalSales = sales.reduce((a, s) => a + s.total, 0);
    const totalQty = sales.reduce((a, s) => a + s.quantityKg, 0);
    const receivedFromSales = sales.reduce((a, s) => a + s.initialReceived, 0);
    const receivedFromPayments = payments.reduce((a, p) => a + p.amount, 0);
    const receivedTotal = receivedFromSales + receivedFromPayments;
    const pendingFromDay = sales.reduce((a, s) => a + Math.max(0, s.total - s.received), 0);
    const purchaseAmount = purchases.reduce((a, b) => a + b.amount, 0);
    const customerCount = new Set(sales.map((s) => s.customerId)).size;

    // Advance movements on this day (across all customers) + current advance per customer.
    let advanceAdded = 0;
    let advanceUsed = 0;
    data.customers.forEach((c) => {
      customerAdvanceHistory(c.id).forEach((h) => {
        if (ymd(h.date) === date) {
          if (h.type === "added") advanceAdded += h.amount;
          else advanceUsed += h.amount;
        }
      });
    });
    const advanceByCustomer: Record<string, number> = {};
    Array.from(new Set(sales.map((s) => s.customerId))).forEach((cid) => {
      advanceByCustomer[cid] = customerAdvance(cid);
    });

    return {
      sales,
      payments,
      purchases,
      totalSales,
      totalQty,
      receivedTotal,
      pendingFromDay,
      purchaseAmount,
      customerCount,
      advanceAdded: Math.round(advanceAdded * 100) / 100,
      advanceUsed: Math.round(advanceUsed * 100) / 100,
      advanceByCustomer,
    };
  }, [data, date, customerAdvance, customerAdvanceHistory]);

  const dateLabel = fmtDate(date);
  const businessName = data.settings.businessName;

  const buildHtml = (): string => {
    const rowsSales = report.sales
      .map((s, i) => {
        const st = statusOf(s);
        const pending = Math.max(0, s.total - s.received);
        const color = st === "Paid" ? "#2E7D32" : st === "Partial" ? "#8A5A00" : "#D32F2F";
        const bg = st === "Paid" ? "#E8F5E9" : st === "Partial" ? "#FFF3CD" : "#FDECEA";
        return `<tr>
          <td>${i + 1}</td>
          <td><b>${escapeHtml(s.customerName)}</b></td>
          <td class="num">${s.quantityKg}</td>
          <td class="num">${money(s.pricePerKg, currency)}</td>
          <td class="num">${money(s.total, currency)}</td>
          <td class="num">${money(s.received, currency)}</td>
          <td class="num">${money(pending, currency)}</td>
          <td><span class="badge" style="color:${color};background:${bg}">${st}</span></td>
        </tr>`;
      })
      .join("");

    const rowsPayments = report.payments
      .map((p: Payment, i) => {
        const c = getCustomer(p.customerId);
        return `<tr>
          <td>${i + 1}</td>
          <td><b>${escapeHtml(c?.name || "Unknown")}</b></td>
          <td class="num">${money(p.amount, currency)}</td>
        </tr>`;
      })
      .join("");

    const rowsPurchases = report.purchases
      .map((b, i) => {
        const st = b.paid ? "Paid" : "Unpaid";
        const color = b.paid ? "#2E7D32" : "#D32F2F";
        const bg = b.paid ? "#E8F5E9" : "#FDECEA";
        return `<tr>
          <td>${i + 1}</td>
          <td><b>${escapeHtml(b.traderName)}</b></td>
          <td class="num">${money(b.amount, currency)}</td>
          <td><span class="badge" style="color:${color};background:${bg}">${st}</span></td>
        </tr>`;
      })
      .join("");

    const advCustomers = Array.from(new Set(report.sales.map((s) => s.customerId)))
      .map((cid) => ({
        name: getCustomer(cid)?.name || "Unknown",
        adv: report.advanceByCustomer[cid] || 0,
      }))
      .filter((x) => x.adv > 0.0001);
    const rowsAdvance = advCustomers
      .map(
        (x, i) =>
          `<tr><td>${i + 1}</td><td><b>${escapeHtml(x.name)}</b></td><td class="num">${money(x.adv, currency)}</td></tr>`,
      )
      .join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #1A1F1C; padding: 28px; }
        .head { border-bottom: 3px solid #2E7D32; padding-bottom: 14px; margin-bottom: 18px; }
        .brand { font-size: 22px; font-weight: 800; color: #1B5E20; }
        .title { font-size: 13px; letter-spacing: 1px; color: #5C6B5F; text-transform: uppercase; margin-top: 4px; }
        .date { font-size: 16px; font-weight: 700; margin-top: 6px; }
        .cards { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0 22px; }
        .stat { flex: 1 1 30%; border: 1px solid #E0E8E1; border-radius: 12px; padding: 12px 14px; background: #F4F7F4; }
        .stat .l { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #5C6B5F; font-weight: 700; }
        .stat .v { font-size: 20px; font-weight: 800; color: #1A1F1C; margin-top: 4px; }
        h2 { font-size: 15px; margin: 22px 0 8px; color: #1B5E20; }
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
          <div class="title">Daily Statement</div>
          <div class="date">${dateLabel}</div>
        </div>

        <div class="cards">
          <div class="stat"><div class="l">Total Sales</div><div class="v">${money(report.totalSales, currency)}</div></div>
          <div class="stat"><div class="l">Quantity Sold</div><div class="v">${kg(report.totalQty)}</div></div>
          <div class="stat"><div class="l">Bills</div><div class="v">${report.sales.length}</div></div>
          <div class="stat"><div class="l">Customers</div><div class="v">${report.customerCount}</div></div>
          <div class="stat"><div class="l">Received</div><div class="v">${money(report.receivedTotal, currency)}</div></div>
          <div class="stat"><div class="l">Pending (this day)</div><div class="v">${money(report.pendingFromDay, currency)}</div></div>
          <div class="stat"><div class="l">Advance Added</div><div class="v">${money(report.advanceAdded, currency)}</div></div>
          <div class="stat"><div class="l">Advance Used</div><div class="v">${money(report.advanceUsed, currency)}</div></div>
        </div>

        <h2>Sales / Bills</h2>
        ${report.sales.length === 0 ? '<div class="empty">No sales recorded on this day.</div>' : `<table>
          <thead><tr><th>#</th><th>Customer</th><th class="num">Qty (kg)</th><th class="num">Price/kg</th><th class="num">Total</th><th class="num">Received</th><th class="num">Pending</th><th>Status</th></tr></thead>
          <tbody>${rowsSales}
            <tr class="total"><td></td><td>TOTAL</td><td class="num">${report.totalQty}</td><td></td><td class="num">${money(report.totalSales, currency)}</td><td></td><td class="num">${money(report.pendingFromDay, currency)}</td><td></td></tr>
          </tbody></table>`}

        <h2>Payments Collected</h2>
        ${report.payments.length === 0 ? '<div class="empty">No separate payments collected on this day.</div>' : `<table>
          <thead><tr><th>#</th><th>Customer</th><th class="num">Amount</th></tr></thead>
          <tbody>${rowsPayments}</tbody></table>`}

        <h2>Purchases (You Owe Traders)</h2>
        ${report.purchases.length === 0 ? '<div class="empty">No purchase bills on this day.</div>' : `<table>
          <thead><tr><th>#</th><th>Trader</th><th class="num">Amount</th><th>Status</th></tr></thead>
          <tbody>${rowsPurchases}
            <tr class="total"><td></td><td>TOTAL</td><td class="num">${money(report.purchaseAmount, currency)}</td><td></td></tr>
          </tbody></table>`}

        <h2>Advance Balances (current)</h2>
        ${advCustomers.length === 0 ? '<div class="empty">No customer has an advance balance.</div>' : `<table>
          <thead><tr><th>#</th><th>Customer</th><th class="num">Advance</th></tr></thead>
          <tbody>${rowsAdvance}</tbody></table>`}

        <div class="foot">Generated by ${escapeHtml(businessName)} · GarlicLedger Pro · ${dayjs().format("DD MMM YYYY, hh:mm A")}</div>
      </body></html>`;
  };

  const onExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportHtmlAsPdf(buildHtml());
    } finally {
      setExporting(false);
    }
  };

  const Stat = ({ label, value, tone }: { label: string; value: string; tone?: "pending" }) => (
    <Card style={{ flexGrow: 1, flexBasis: "30%", minWidth: 140, padding: spacing.md }}>
      <Label>{label}</Label>
      <Text
        style={{
          color: tone === "pending" && report.pendingFromDay > 0 ? theme.error : theme.onSurface,
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
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Date picker */}
        <Label>Report Date</Label>
        <View style={{ marginTop: spacing.sm }}>
          <DateField label="" value={date} onChange={setDate} testID="day-report-date" />
        </View>

        {/* Summary grid */}
        <View style={styles.grid}>
          <Stat label="Total Sales" value={money(report.totalSales, currency)} />
          <Stat label="Quantity" value={kg(report.totalQty)} />
          <Stat label="Bills" value={String(report.sales.length)} />
          <Stat label="Customers" value={String(report.customerCount)} />
          <Stat label="Received" value={money(report.receivedTotal, currency)} />
          <Stat label="Pending" value={money(report.pendingFromDay, currency)} tone="pending" />
          <Stat label="Advance Added" value={money(report.advanceAdded, currency)} />
          <Stat label="Advance Used" value={money(report.advanceUsed, currency)} />
        </View>

        {/* Sales list */}
        <H2 style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Customers &amp; Bills</H2>
        {report.sales.length === 0 ? (
          <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <MaterialCommunityIcons
              name="cart-off"
              size={30}
              color={theme.muted}
              style={{ marginBottom: spacing.sm }}
            />
            <Body muted>No sales on this day</Body>
          </Card>
        ) : (
          report.sales.map((s) => {
            const st = statusOf(s);
            const pending = Math.max(0, s.total - s.received);
            return (
              <Card key={s.id} style={{ marginBottom: spacing.sm }} testID={`day-report-sale-${s.id}`}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "700" }}>
                      {s.customerName}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                      {kg(s.quantityKg)} × {money(s.pricePerKg, currency)}
                      {report.advanceByCustomer[s.customerId] > 0.0001
                        ? ` · Advance ${money(report.advanceByCustomer[s.customerId], currency)}`
                        : ""}
                    </Text>
                  </View>
                  <Badge label={st} tone={toneOf(st)} />
                </View>
                <View style={styles.billRow}>
                  <View style={{ flex: 1 }}>
                    <Label>Total</Label>
                    <Text style={styles.billVal}>{money(s.total, currency)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label>Received</Label>
                    <Text style={[styles.billVal, { color: theme.brandPrimary }]}>
                      {money(s.received, currency)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label>Pending</Label>
                    <Text style={[styles.billVal, { color: pending > 0 ? theme.error : theme.onSurface }]}>
                      {money(pending, currency)}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}

        {/* Payments collected */}
        {report.payments.length > 0 ? (
          <>
            <H2 style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Payments Collected</H2>
            {report.payments.map((p) => {
              const c = getCustomer(p.customerId);
              return (
                <Card key={p.id} style={{ marginBottom: spacing.sm, flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ flex: 1, color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "700" }}>
                    {c?.name || "Unknown"}
                  </Text>
                  <Text style={{ color: theme.brandPrimary, fontSize: fontSize.lg, fontWeight: "800" }}>
                    {money(p.amount, currency)}
                  </Text>
                </Card>
              );
            })}
          </>
        ) : null}

        {/* Purchases */}
        {report.purchases.length > 0 ? (
          <>
            <H2 style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Purchases</H2>
            {report.purchases.map((b) => (
              <Card key={b.id} style={{ marginBottom: spacing.sm, flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "700" }}>
                  {b.traderName}
                </Text>
                <Text style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "800", marginRight: spacing.md }}>
                  {money(b.amount, currency)}
                </Text>
                <Badge label={b.paid ? "Paid" : "Unpaid"} tone={b.paid ? "success" : "error"} />
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>

      {/* Sticky export button */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.divider,
        }}
      >
        <Button
          label="Export PDF Statement"
          onPress={onExport}
          loading={exporting}
          fullWidth
          testID="day-report-export-pdf"
          icon={<MaterialCommunityIcons name="file-pdf-box" size={22} color={theme.onBrandPrimary} />}
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
