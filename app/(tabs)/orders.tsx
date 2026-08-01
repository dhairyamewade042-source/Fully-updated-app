// Upcoming Orders — sticky filter chips + list, tap card to open detail.

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Badge, Card, EmptyState } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fmtDateShort, isThisWeek, isToday, isTomorrow, kg, money } from "@/src/lib/format";
import { fontSize, radius, spacing } from "@/src/lib/theme";
import { Order, OrderStatus } from "@/src/lib/types";

type FilterKey = "today" | "tomorrow" | "week" | "all";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week", label: "This Week" },
  { key: "all", label: "All" },
];

const statusTone = (s: OrderStatus): "success" | "warning" | "error" | "info" | "neutral" => {
  switch (s) {
    case "confirmed":
      return "info";
    case "completed":
      return "success";
    case "cancelled":
      return "error";
    default:
      return "warning";
  }
};

export default function OrdersScreen() {
  const { theme, data } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterKey>("today");
  const currency = data.settings.currency;

  const orders = useMemo(() => {
    // Exclude cancelled + completed so filters match the dashboard counters.
    const active = data.orders.filter(
      (o) => o.status !== "cancelled" && o.status !== "completed",
    );
    const list = active.filter((o) => {
      if (filter === "today") return isToday(o.deliveryDate);
      if (filter === "tomorrow") return isTomorrow(o.deliveryDate);
      if (filter === "week") return isThisWeek(o.deliveryDate);
      return true;
    });
    return list.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  }, [data.orders, filter]);

  const counts = useMemo(() => {
    const active = data.orders.filter(
      (o) => o.status !== "cancelled" && o.status !== "completed",
    );
    return {
      today: active.filter((o) => isToday(o.deliveryDate)).length,
      tomorrow: active.filter((o) => isTomorrow(o.deliveryDate)).length,
      week: active.filter((o) => isThisWeek(o.deliveryDate)).length,
      all: active.length,
    };
  }, [data.orders]);

  const renderCard = (o: Order) => {
    const highlight = isToday(o.deliveryDate) && o.status !== "completed" && o.status !== "cancelled";
    return (
      <Pressable
        key={o.id}
        testID={`order-${o.id}`}
        onPress={() => router.push(`/order/${o.id}`)}
      >
        <Card
          style={{
            marginBottom: spacing.md,
            borderLeftWidth: highlight ? 4 : 1,
            borderLeftColor: highlight ? theme.brandPrimary : theme.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "800" }}>
                {o.customerName}
              </Text>
              {o.phone ? (
                <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>{o.phone}</Text>
              ) : null}
            </View>
            <Badge label={o.status} tone={statusTone(o.status)} />
          </View>

          <View style={{ flexDirection: "row", marginTop: spacing.md, gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.muted, fontSize: fontSize.xs, fontWeight: "700", textTransform: "uppercase" }}>
                Delivery
              </Text>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "700", marginTop: 2 }}>
                {fmtDateShort(o.deliveryDate)}
                {o.deliveryTime ? ` · ${o.deliveryTime}` : ""}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.muted, fontSize: fontSize.xs, fontWeight: "700", textTransform: "uppercase" }}>
                Quantity
              </Text>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "700", marginTop: 2 }}>
                {kg(o.quantityKg)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.muted, fontSize: fontSize.xs, fontWeight: "700", textTransform: "uppercase" }}>
                Est. Total
              </Text>
              <Text
                style={{ color: theme.brandPrimary, fontSize: fontSize.md, fontWeight: "800", marginTop: 2 }}
              >
                {money(o.estimatedTotal, currency)}
              </Text>
            </View>
          </View>

          {o.address ? (
            <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: spacing.md }} numberOfLines={2}>
              <Ionicons name="location-outline" size={13} color={theme.muted} /> {o.address}
            </Text>
          ) : null}
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader
        title="Upcoming Orders"
        subtitle={`${orders.length} in view`}
        right={
          <Pressable
            testID="orders-new"
            onPress={() => router.push("/order/new")}
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

      {/* Sticky filter chip row — horizontal scroller, does not wrap. */}
      <View style={{ backgroundColor: theme.surface }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          }}
          style={{ height: 56 }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = counts[f.key];
            return (
              <Pressable
                key={f.key}
                testID={`orders-filter-${f.key}`}
                onPress={() => setFilter(f.key)}
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
                  {f.label} · {count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: 120 + insets.bottom,
        }}
        ListEmptyComponent={
          <EmptyState
            title="No orders in this window"
            subtitle="Tap + to record an order customers have booked for a future date."
            icon={<MaterialCommunityIcons name="clipboard-outline" size={30} color={theme.brandPrimary} />}
          />
        }
        renderItem={({ item }) => renderCard(item)}
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
