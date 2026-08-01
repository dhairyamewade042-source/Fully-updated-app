// Reports — daily/weekly/monthly/yearly summaries.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Body, Card, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { kg, money } from "@/src/lib/format";
import { fontSize, radius, spacing } from "@/src/lib/theme";

type Range = "daily" | "weekly" | "monthly" | "yearly";
const RANGES: { key: Range; label: string }[] = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This Week" },
  { key: "monthly", label: "This Month" },
  { key: "yearly", label: "This Year" },
];

const rangeBounds = (r: Range): [dayjs.Dayjs, dayjs.Dayjs] => {
  const now = dayjs();
  switch (r) {
    case "daily":
      return [now.startOf("day"), now.endOf("day")];
    case "weekly":
      return [now.startOf("week"), now.endOf("week")];
    case "monthly":
      return [now.startOf("month"), now.endOf("month")];
    case "yearly":
      return [now.startOf("year"), now.endOf("year")];
  }
};

export default function ReportsScreen() {
  const { theme, data } = useApp();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<Range>("monthly");
  const currency = data.settings.currency;

  const stats = useMemo(() => {
    const [start, end] = rangeBounds(range);
    const inRange = (iso: string) => {
      const d = dayjs(iso);
      return (d.isAfter(start) || d.isSame(start)) && (d.isBefore(end) || d.isSame(end));
    };
    const sales = data.sales.filter((s) => inRange(s.date));
    const payments = data.payments.filter((p) => inRange(p.date));
    const totalSales = sales.reduce((a, s) => a + s.total, 0);
    const totalQuantity = sales.reduce((a, s) => a + s.quantityKg, 0);
    const totalReceived = payments.reduce((a, p) => a + p.amount, 0) + sales.reduce((a, s) => a + Math.min(s.received, s.total), 0);
    const totalPending = data.sales.reduce((a, s) => a + Math.max(0, s.total - s.received), 0);
    const customerAgg = new Map<string, { name: string; amount: number; qty: number }>();
    sales.forEach((s) => {
      const prev = customerAgg.get(s.customerId);
      if (prev) {
        prev.amount += s.total;
        prev.qty += s.quantityKg;
      } else {
        customerAgg.set(s.customerId, { name: s.customerName, amount: s.total, qty: s.quantityKg });
      }
    });
    const bestCustomers = Array.from(customerAgg.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const days = Math.max(1, end.diff(start, "day") + 1);
    const avgDaily = totalSales / days;
    return {
      totalSales,
      totalQuantity,
      totalReceived,
      totalPending,
      numCustomers: customerAgg.size,
      bestCustomers,
      avgDaily,
      salesCount: sales.length,
    };
  }, [data, range]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader title="Reports" subtitle="Business performance at a glance" showBack />

      <View style={{ backgroundColor: theme.surface }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}
          style={{ height: 56 }}
        >
          {RANGES.map((r) => {
            const active = range === r.key;
            return (
              <Pressable
                key={r.key}
                testID={`report-range-${r.key}`}
                onPress={() => setRange(r.key)}
                style={({ pressed }) => ({
                  flexShrink: 0,
                  height: 36,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.pill,
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: active ? theme.brandPrimary : theme.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: active ? theme.brandPrimary : theme.border,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color: active ? theme.onBrandPrimary : theme.onSurface,
                    fontWeight: "700",
                    fontSize: fontSize.sm,
                  }}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 + insets.bottom }}>
        <Card style={{ backgroundColor: theme.brandPrimary, borderColor: theme.brandPrimary }}>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: fontSize.sm }}>
            TOTAL SALES
          </Text>
          <Text style={{ color: theme.onBrandPrimary, fontSize: 34, fontWeight: "800", marginTop: 2 }}>
            {money(stats.totalSales, currency)}
          </Text>
          <View style={{ flexDirection: "row", marginTop: spacing.md, gap: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: fontSize.sm, fontWeight: "700" }}>Quantity</Text>
              <Text style={{ color: theme.onBrandPrimary, fontSize: fontSize.xl, fontWeight: "800", marginTop: 2 }}>
                {kg(stats.totalQuantity)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: fontSize.sm, fontWeight: "700" }}>
                Sales Count
              </Text>
              <Text style={{ color: theme.onBrandPrimary, fontSize: fontSize.xl, fontWeight: "800", marginTop: 2 }}>
                {stats.salesCount}
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
          <Card style={{ flex: 1 }}>
            <Label>Received</Label>
            <Text style={{ color: theme.brandPrimary, fontSize: fontSize.xl, fontWeight: "800", marginTop: 2 }}>
              {money(stats.totalReceived, currency)}
            </Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Label>Outstanding</Label>
            <Text style={{ color: theme.error, fontSize: fontSize.xl, fontWeight: "800", marginTop: 2 }}>
              {money(stats.totalPending, currency)}
            </Text>
          </Card>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
          <Card style={{ flex: 1 }}>
            <Label>Customers</Label>
            <Text style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800", marginTop: 2 }}>
              {stats.numCustomers}
            </Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Label>Avg / Day</Label>
            <Text style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800", marginTop: 2 }}>
              {money(stats.avgDaily, currency)}
            </Text>
          </Card>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Label>Best Customers</Label>
        </View>
        {stats.bestCustomers.length === 0 ? (
          <Card style={{ marginTop: spacing.sm, alignItems: "center" }}>
            <Body muted>No sales in this window</Body>
          </Card>
        ) : (
          stats.bestCustomers.map((c, i) => (
            <Card key={c.name + i} style={{ marginTop: spacing.sm, flexDirection: "row", alignItems: "center" }}>
              <View
                style={[
                  styles.rank,
                  { backgroundColor: i === 0 ? theme.brandPrimary : theme.brandTertiary },
                ]}
              >
                <Text
                  style={{
                    color: i === 0 ? theme.onBrandPrimary : theme.onBrandTertiary,
                    fontWeight: "800",
                  }}
                >
                  {i + 1}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "700" }}>
                  {c.name}
                </Text>
                <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                  {kg(c.qty)}
                </Text>
              </View>
              <Text style={{ color: theme.brandPrimary, fontSize: fontSize.md, fontWeight: "800" }}>
                {money(c.amount, currency)}
              </Text>
            </Card>
          ))
        )}

        <View style={{ marginTop: spacing.xl }}>
          <Label>Outstanding Payments</Label>
        </View>
        <Card style={{ marginTop: spacing.sm, flexDirection: "row", alignItems: "center" }}>
          <MaterialCommunityIcons name="cash-clock" size={22} color={theme.error} />
          <Text style={{ marginLeft: spacing.sm, flex: 1, color: theme.onSurface, fontWeight: "700" }}>
            All-time outstanding
          </Text>
          <Text style={{ color: theme.error, fontWeight: "800", fontSize: fontSize.md }}>
            {money(stats.totalPending, currency)}
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rank: {
    height: 32,
    width: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
