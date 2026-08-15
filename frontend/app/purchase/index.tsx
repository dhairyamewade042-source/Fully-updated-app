// Purchase Bills — trader-grouped overview.
// Shows a summary (total bills · pending · outstanding), a trader search, and a
// list of TRADERS (not individual bills). Tapping a trader opens that trader's
// bills. All figures are derived from the existing traderBills data.

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, EmptyState, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { money } from "@/src/lib/format";
import { groupByTrader, purchaseSummary } from "@/src/lib/purchase";
import { fontSize, radius, spacing } from "@/src/lib/theme";

export default function PurchaseListScreen() {
  const { theme, data } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const currency = data.settings.currency;

  const summary = useMemo(() => purchaseSummary(data.traderBills), [data.traderBills]);

  const traders = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = groupByTrader(data.traderBills);
    if (q) {
      list = list.filter(
        (g) => g.name.toLowerCase().includes(q) || (g.phone || "").includes(q),
      );
    }
    // Outstanding first, then most recent activity, then name.
    return list.sort(
      (a, b) =>
        b.outstanding - a.outstanding ||
        b.lastDate.localeCompare(a.lastDate) ||
        a.name.localeCompare(b.name),
    );
  }, [data.traderBills, query]);

  const summaryLine = `${summary.totalBills} ${summary.totalBills === 1 ? "Bill" : "Bills"} · ${summary.pendingBills} Pending · ${money(summary.outstanding, currency)} Outstanding`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader
        title="Purchase Bills"
        subtitle={summaryLine}
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

      {/* Summary band */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Card testID="purchase-summary" style={{ flexDirection: "row" }}>
          <View style={{ flex: 1 }}>
            <Label>Total Bills</Label>
            <Text style={[styles.summaryVal, { color: theme.onSurface }]} testID="purchase-summary-total">
              {summary.totalBills}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: theme.divider, marginHorizontal: spacing.sm }} />
          <View style={{ flex: 1 }}>
            <Label>Pending</Label>
            <Text
              style={[styles.summaryVal, { color: summary.pendingBills > 0 ? theme.error : theme.onSurface }]}
              testID="purchase-summary-pending"
            >
              {summary.pendingBills}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: theme.divider, marginHorizontal: spacing.sm }} />
          <View style={{ flex: 1.4 }}>
            <Label>Outstanding</Label>
            <Text
              style={[styles.summaryVal, { color: summary.outstanding > 0 ? theme.error : theme.brandPrimary }]}
              testID="purchase-summary-outstanding"
            >
              {money(summary.outstanding, currency)}
            </Text>
          </View>
        </Card>
      </View>

      {/* Trader search */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
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
            testID="purchase-trader-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search traders by name or phone"
            placeholderTextColor={theme.muted}
            style={{ flex: 1, marginLeft: spacing.sm, color: theme.onSurface, fontSize: fontSize.md }}
          />
          {query ? (
            <Pressable testID="purchase-trader-search-clear" onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={theme.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={traders}
        keyExtractor={(g) => g.key}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: 40 + insets.bottom,
        }}
        ListEmptyComponent={
          <EmptyState
            title={query ? "No traders match your search" : "No purchase bills yet"}
            subtitle={
              query
                ? "Try a different name or phone number."
                : "Tap + to log a bill from your trader. You can snap a photo of the bill and mark it Paid or Unpaid."
            }
            icon={<MaterialCommunityIcons name="account-cash-outline" size={30} color={theme.brandPrimary} />}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`trader-row-${item.key}`}
            onPress={() => router.push(`/purchase/trader/${encodeURIComponent(item.name)}`)}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Card style={{ marginBottom: spacing.md, flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  height: 46,
                  width: 46,
                  borderRadius: radius.pill,
                  marginRight: spacing.md,
                  backgroundColor: theme.brandTertiary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons name="store-outline" size={24} color={theme.brandPrimary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "800" }}
                >
                  {item.name}
                </Text>
                <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                  {item.billCount} {item.billCount === 1 ? "bill" : "bills"} · Purchase{" "}
                  {money(item.totalPurchase, currency)}
                  {item.pendingCount > 0 ? ` · ${item.pendingCount} pending` : ""}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end", marginLeft: spacing.sm }}>
                <Text
                  style={{
                    color: item.outstanding > 0 ? theme.error : theme.brandPrimary,
                    fontSize: fontSize.lg,
                    fontWeight: "800",
                  }}
                >
                  {money(item.outstanding, currency)}
                </Text>
                <Text style={{ color: theme.muted, fontSize: fontSize.xs, marginTop: 2 }}>
                  {item.outstanding > 0 ? "Outstanding" : "Cleared"}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color={theme.muted} style={{ marginLeft: spacing.xs }} />
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
  summaryVal: {
    fontSize: fontSize.xl,
    fontWeight: "800",
    marginTop: 2,
  },
});
