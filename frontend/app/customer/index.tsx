// Customers directory — search, sort, tap into ledger.

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, EmptyState } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { money } from "@/src/lib/format";
import { fontSize, radius, spacing } from "@/src/lib/theme";

type SortKey = "name" | "pending" | "recent";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "name", label: "Name" },
  { key: "pending", label: "Pending" },
];

export default function CustomerListScreen() {
  const { theme, data, customerBalance } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const currency = data.settings.currency;

  const rows = useMemo(() => {
    const enriched = data.customers.map((c) => {
      const salesForCustomer = data.sales.filter((s) => s.customerId === c.id);
      return {
        ...c,
        pending: customerBalance(c.id),
        purchases: salesForCustomer.length,
        totalPurchased: salesForCustomer.reduce((a, s) => a + s.total, 0),
      };
    });
    const q = query.trim().toLowerCase();
    const filtered = q
      ? enriched.filter(
          (c) => c.name.toLowerCase().includes(q) || (c.phone || "").includes(q),
        )
      : enriched;
    const sorted = filtered.slice();
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "pending") sorted.sort((a, b) => b.pending - a.pending);
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [data.customers, data.sales, query, sort, customerBalance]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader title="Customers" subtitle={`${rows.length} in view`} showBack />

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
            testID="customer-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search customers"
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

      <View
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
        }}
      >
        {SORTS.map((s) => {
          const active = sort === s.key;
          return (
            <Pressable
              key={s.key}
              testID={`customer-sort-${s.key}`}
              onPress={() => setSort(s.key)}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.md,
                height: 32,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: active ? theme.brandPrimary : theme.border,
                backgroundColor: active ? theme.brandPrimary : theme.surfaceSecondary,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  color: active ? theme.onBrandPrimary : theme.onSurface,
                  fontSize: fontSize.sm,
                  fontWeight: "700",
                }}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 40 + insets.bottom,
        }}
        ListEmptyComponent={
          <EmptyState
            title="No customers yet"
            subtitle="Add your first sale — customers are created automatically."
            icon={<Ionicons name="people-outline" size={28} color={theme.brandPrimary} />}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`customer-row-${item.id}`}
            onPress={() => router.push(`/customer/${item.id}`)}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Card style={{ marginBottom: spacing.sm, flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  height: 44,
                  width: 44,
                  borderRadius: radius.pill,
                  backgroundColor: theme.brandTertiary,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: spacing.md,
                }}
              >
                <Text style={{ color: theme.onBrandTertiary, fontSize: fontSize.lg, fontWeight: "800" }}>
                  {item.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "700" }}>
                  {item.name}
                </Text>
                <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                  {item.phone || "No phone"} · {item.purchases} purchase{item.purchases === 1 ? "" : "s"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    color: item.pending > 0 ? theme.error : theme.brandPrimary,
                    fontSize: fontSize.md,
                    fontWeight: "800",
                  }}
                >
                  {money(item.pending, currency)}
                </Text>
                <Text style={{ color: theme.muted, fontSize: fontSize.xs, marginTop: 2 }}>
                  {item.pending > 0 ? "PENDING" : "CLEAR"}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({});
