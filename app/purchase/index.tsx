// Purchase Bills — list of raw-material bills from traders.

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, EmptyState, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fmtDate, money } from "@/src/lib/format";
import { fontSize, radius, spacing } from "@/src/lib/theme";

type Filter = "all" | "unpaid" | "paid";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "paid", label: "Paid" },
];

export default function PurchaseListScreen() {
  const { theme, data } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("unpaid");
  const currency = data.settings.currency;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = data.traderBills.slice();
    if (filter === "paid") list = list.filter((b) => b.paid);
    else if (filter === "unpaid") list = list.filter((b) => !b.paid);
    if (q) {
      list = list.filter(
        (b) =>
          b.traderName.toLowerCase().includes(q) ||
          (b.phone || "").includes(q) ||
          (b.notes || "").toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.traderBills, filter, query]);

  const totals = useMemo(() => {
    const unpaid = data.traderBills.filter((b) => !b.paid).reduce((a, b) => a + b.amount, 0);
    const paid = data.traderBills.filter((b) => b.paid).reduce((a, b) => a + b.amount, 0);
    return { unpaid, paid, all: unpaid + paid, count: data.traderBills.length };
  }, [data.traderBills]);

  const counts = useMemo(
    () => ({
      all: data.traderBills.length,
      unpaid: data.traderBills.filter((b) => !b.paid).length,
      paid: data.traderBills.filter((b) => b.paid).length,
    }),
    [data.traderBills],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader
        title="Purchase Bills"
        subtitle={`${totals.count} bills · you owe ${money(totals.unpaid, currency)}`}
        showBack
        right={
          <Pressable
            testID="purchase-new"
            onPress={() => router.push("/purchase/new")}
            hitSlop={10}
            style={({ pressed }) => [
              styles.newBtn,
              { backgroundColor: theme.brandPrimary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="add" size={22} color="#FFF" />
          </Pressable>
        }
      />

      {/* Totals band */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Card
            style={{ flex: 1, backgroundColor: "#FDECEA", borderColor: "#F5C6CB" }}
            testID="purchase-total-unpaid"
          >
            <Label>Unpaid</Label>
            <Text
              style={{ color: theme.error, fontSize: fontSize.xl, fontWeight: "800", marginTop: 2 }}
            >
              {money(totals.unpaid, currency)}
            </Text>
          </Card>
          <Card style={{ flex: 1 }} testID="purchase-total-paid">
            <Label>Paid</Label>
            <Text
              style={{
                color: theme.brandPrimary,
                fontSize: fontSize.xl,
                fontWeight: "800",
                marginTop: 2,
              }}
            >
              {money(totals.paid, currency)}
            </Text>
          </Card>
        </View>
      </View>

      {/* Search */}
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
            testID="purchase-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search trader, phone, notes"
            placeholderTextColor={theme.muted}
            style={{ flex: 1, marginLeft: spacing.sm, color: theme.onSurface, fontSize: fontSize.md }}
          />
        </View>
      </View>

      {/* Filter chips */}
      <View
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              testID={`purchase-filter-${f.key}`}
              onPress={() => setFilter(f.key)}
              style={({ pressed }) => ({
                flexShrink: 0,
                height: 34,
                paddingHorizontal: spacing.md,
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
                  fontWeight: "700",
                  fontSize: fontSize.sm,
                }}
              >
                {f.label} · {counts[f.key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: 0,
          paddingBottom: 40 + insets.bottom,
        }}
        ListEmptyComponent={
          <EmptyState
            title="No purchase bills yet"
            subtitle="Tap + to log a bill from your trader. You can snap a photo of the bill and mark it Paid or Unpaid."
            icon={<MaterialCommunityIcons name="file-image-outline" size={30} color={theme.brandPrimary} />}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`purchase-row-${item.id}`}
            onPress={() => router.push(`/purchase/${item.id}`)}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Card style={{ marginBottom: spacing.md, flexDirection: "row" }}>
              {item.photoBase64 ? (
                <Image
                  source={{ uri: item.photoBase64 }}
                  style={{ height: 64, width: 64, borderRadius: radius.md, marginRight: spacing.md }}
                />
              ) : (
                <View
                  style={{
                    height: 64,
                    width: 64,
                    borderRadius: radius.md,
                    marginRight: spacing.md,
                    backgroundColor: theme.brandTertiary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name="file-outline" size={26} color={theme.brandPrimary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}
                >
                  <Text
                    style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "800", flex: 1 }}
                  >
                    {item.traderName}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 3,
                      borderRadius: radius.pill,
                      backgroundColor: item.paid ? theme.brandTertiary : "#FDECEA",
                    }}
                  >
                    <Text
                      style={{
                        color: item.paid ? theme.onBrandTertiary : theme.error,
                        fontWeight: "800",
                        fontSize: fontSize.xs,
                      }}
                    >
                      {item.paid ? "PAID" : "UNPAID"}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                  {fmtDate(item.date)}
                  {item.quantityKg ? ` · ${item.quantityKg} kg` : ""}
                </Text>
                <Text
                  style={{
                    color: item.paid ? theme.onSurface : theme.error,
                    fontSize: fontSize.lg,
                    fontWeight: "800",
                    marginTop: 4,
                  }}
                >
                  {money(item.amount, currency)}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  newBtn: {
    height: 40,
    width: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
