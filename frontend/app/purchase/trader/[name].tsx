// Trader detail — all purchase bills for one trader.
// Each bill shows Date, Bill amount, Paid, Remaining and a Paid/Partially Paid/Unpaid
// status. Tapping a bill opens the existing bill details screen (with its photo).

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Badge, Card, EmptyState, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fmtDate, money } from "@/src/lib/format";
import { billPayment, billsForTrader, PurchaseStatus } from "@/src/lib/purchase";
import { fontSize, radius, spacing } from "@/src/lib/theme";

const toneOf = (st: PurchaseStatus): "success" | "warning" | "error" =>
  st === "Paid" ? "success" : st === "Partially Paid" ? "warning" : "error";

export default function TraderDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, data } = useApp();
  const currency = data.settings.currency;

  const traderName = decodeURIComponent(String(name || ""));
  const bills = useMemo(
    () => billsForTrader(data.traderBills, traderName),
    [data.traderBills, traderName],
  );

  const totals = useMemo(() => {
    let purchase = 0;
    let outstanding = 0;
    let pendingCount = 0;
    for (const b of bills) {
      const { remaining } = billPayment(b);
      purchase += b.amount || 0;
      outstanding += remaining;
      if (remaining > 0.0001) pendingCount += 1;
    }
    return {
      purchase: Math.round(purchase * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      pendingCount,
    };
  }, [bills]);

  const displayName = bills[0]?.traderName || traderName;

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader
        title={displayName}
        subtitle={`${bills.length} ${bills.length === 1 ? "bill" : "bills"} · ${money(totals.outstanding, currency)} outstanding`}
        showBack
      />

      {/* Trader summary */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Card testID="trader-summary" style={{ flexDirection: "row" }}>
          <View style={{ flex: 1 }}>
            <Label>Total Purchase</Label>
            <Text style={[styles.val, { color: theme.onSurface }]}>{money(totals.purchase, currency)}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: theme.divider, marginHorizontal: spacing.sm }} />
          <View style={{ flex: 1 }}>
            <Label>Pending Bills</Label>
            <Text style={[styles.val, { color: totals.pendingCount > 0 ? theme.error : theme.onSurface }]}>
              {totals.pendingCount}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: theme.divider, marginHorizontal: spacing.sm }} />
          <View style={{ flex: 1.3 }}>
            <Label>Outstanding</Label>
            <Text style={[styles.val, { color: totals.outstanding > 0 ? theme.error : theme.brandPrimary }]}>
              {money(totals.outstanding, currency)}
            </Text>
          </View>
        </Card>
      </View>

      <FlatList
        data={bills}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 40 + insets.bottom,
        }}
        ListEmptyComponent={
          <EmptyState
            title="No bills for this trader"
            icon={<MaterialCommunityIcons name="file-outline" size={30} color={theme.brandPrimary} />}
          />
        }
        renderItem={({ item }) => {
          const { paid, remaining, status } = billPayment(item);
          return (
            <Pressable
              testID={`trader-bill-row-${item.id}`}
              onPress={() => router.push(`/purchase/${item.id}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {item.photoBase64 ? (
                    <Image
                      source={{ uri: item.photoBase64 }}
                      style={{ height: 52, width: 52, borderRadius: radius.md, marginRight: spacing.md }}
                    />
                  ) : (
                    <View
                      style={{
                        height: 52,
                        width: 52,
                        borderRadius: radius.md,
                        marginRight: spacing.md,
                        backgroundColor: theme.brandTertiary,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialCommunityIcons name="file-outline" size={24} color={theme.brandPrimary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "700" }}>
                      {fmtDate(item.date)}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                      Bill {money(item.amount, currency)}
                      {item.quantityKg ? ` · ${item.quantityKg} kg` : ""}
                    </Text>
                  </View>
                  <Badge label={status} tone={toneOf(status)} />
                </View>

                <View style={styles.figs}>
                  <View style={{ flex: 1 }}>
                    <Label>Bill Amount</Label>
                    <Text style={styles.figVal}>{money(item.amount, currency)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label>Paid</Label>
                    <Text style={[styles.figVal, { color: theme.brandPrimary }]}>{money(paid, currency)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label>Remaining</Label>
                    <Text style={[styles.figVal, { color: remaining > 0 ? theme.error : theme.onSurface }]}>
                      {money(remaining, currency)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.muted}
                    style={{ alignSelf: "center" }}
                  />
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  val: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    marginTop: 2,
  },
  figs: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  figVal: {
    fontSize: fontSize.md,
    fontWeight: "800",
    marginTop: 2,
  },
});
