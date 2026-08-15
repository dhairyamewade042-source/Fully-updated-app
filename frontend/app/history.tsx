// Sales History — browse past sales, grouped by day, with search and quick edit.

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Body, Card, EmptyState } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fmtDate, kg, money } from "@/src/lib/format";
import { fontSize, radius, spacing } from "@/src/lib/theme";
import { Sale } from "@/src/lib/types";

type Row =
  | { kind: "header"; date: string; total: number; qty: number; count: number }
  | { kind: "sale"; sale: Sale };

export default function HistoryScreen() {
  const { theme, data } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const currency = data.settings.currency;

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? data.sales.filter(
          (s) =>
            s.customerName.toLowerCase().includes(q) ||
            dayjs(s.date).format("DD MMM YYYY").toLowerCase().includes(q),
        )
      : data.sales;
    // Sort newest first
    const sorted = filtered.slice().sort((a, b) => b.date.localeCompare(a.date));
    // Group by day
    const groups = new Map<string, Sale[]>();
    sorted.forEach((s) => {
      const key = dayjs(s.date).format("YYYY-MM-DD");
      const list = groups.get(key) || [];
      list.push(s);
      groups.set(key, list);
    });
    const out: Row[] = [];
    for (const [key, sales] of groups) {
      const total = sales.reduce((a, s) => a + s.total, 0);
      const qty = sales.reduce((a, s) => a + s.quantityKg, 0);
      out.push({ kind: "header", date: key, total, qty, count: sales.length });
      sales.forEach((s) => out.push({ kind: "sale", sale: s }));
    }
    return out;
  }, [data.sales, query]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader
        title="Sales History"
        subtitle={`${data.sales.length} sales · tap any to edit`}
        showBack
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.surfaceSecondary,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.md,
            height: 44,
          }}
        >
          <Ionicons name="search" size={18} color={theme.muted} />
          <TextInput
            testID="history-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search by customer or date"
            placeholderTextColor={theme.muted}
            style={{
              flex: 1,
              marginLeft: spacing.sm,
              color: theme.onSurface,
              fontSize: fontSize.md,
            }}
          />
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r, i) => (r.kind === "header" ? `h-${r.date}` : `s-${r.sale.id}-${i}`)}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 40 + insets.bottom,
        }}
        ListEmptyComponent={
          <EmptyState
            title="No sales yet"
            subtitle="Add your first sale to see it show up here — grouped day by day."
            icon={<MaterialCommunityIcons name="clipboard-text-outline" size={28} color={theme.brandPrimary} />}
          />
        }
        renderItem={({ item }) => {
          if (item.kind === "header") {
            const isToday = item.date === dayjs().format("YYYY-MM-DD");
            const isYesterday =
              item.date === dayjs().subtract(1, "day").format("YYYY-MM-DD");
            const label = isToday
              ? "Today"
              : isYesterday
                ? "Yesterday"
                : dayjs(item.date).format("dddd, DD MMM YYYY");
            return (
              <View
                style={{
                  marginTop: spacing.lg,
                  marginBottom: spacing.sm,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "800" }}
                  >
                    {label}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                    {item.count} sale{item.count === 1 ? "" : "s"} · {kg(item.qty)}
                  </Text>
                </View>
                <Text
                  style={{ color: theme.brandPrimary, fontSize: fontSize.lg, fontWeight: "800" }}
                >
                  {money(item.total, currency)}
                </Text>
              </View>
            );
          }
          const s = item.sale;
          const pending = s.total - s.received;
          return (
            <Pressable
              testID={`history-sale-${s.id}`}
              onPress={() => router.push(`/customer/${s.customerId}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card style={{ marginBottom: spacing.sm, flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    height: 36,
                    width: 36,
                    borderRadius: radius.pill,
                    backgroundColor: pending > 0.0001 ? "#FDECEA" : theme.brandTertiary,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: spacing.md,
                  }}
                >
                  <MaterialCommunityIcons
                    name={pending > 0.0001 ? "cash-clock" : "check"}
                    size={18}
                    color={pending > 0.0001 ? theme.error : theme.brandPrimary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "700" }}>
                    {s.customerName}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                    {kg(s.quantityKg)} @ {money(s.pricePerKg, currency)} · {dayjs(s.date).format("hh:mm A")}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "800" }}>
                    {money(s.total, currency)}
                  </Text>
                  <Text
                    style={{
                      color: pending > 0.0001 ? theme.error : theme.brandPrimary,
                      fontSize: fontSize.xs,
                      fontWeight: "700",
                      marginTop: 2,
                    }}
                  >
                    {pending > 0.0001 ? `Pending ${money(pending, currency)}` : "PAID"}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
      <Body muted style={{ textAlign: "center", padding: spacing.md, fontSize: fontSize.sm }}>
        Tap any sale to open the customer's ledger and edit it.
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({});
