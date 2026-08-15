// Dashboard — selectable date, KPIs for that date, quick actions, upcoming.

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import React, { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateField, DateFieldHandle } from "@/src/components/DateField";
import { Badge, Body, Card, H1, H2, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fmtDateShort, isToday, isTomorrow, kg, money } from "@/src/lib/format";
import { fontSize, radius, spacing } from "@/src/lib/theme";

const QuickAction = ({
  label,
  icon,
  onPress,
  testID,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  testID: string;
  tone?: "primary" | "neutral";
}) => {
  const { theme } = useApp();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        {
          backgroundColor: tone === "primary" ? theme.brandPrimary : theme.surfaceSecondary,
          borderColor: tone === "primary" ? theme.brandPrimary : theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={{
          height: 40,
          width: 40,
          borderRadius: radius.pill,
          backgroundColor:
            tone === "primary" ? "rgba(255,255,255,0.18)" : theme.brandTertiary,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.sm,
        }}
      >
        {icon}
      </View>
      <Text
        style={{
          fontSize: fontSize.md,
          fontWeight: "700",
          color: tone === "primary" ? theme.onBrandPrimary : theme.onSurface,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export default function DashboardScreen() {
  const router = useRouter();
  const { theme, data } = useApp();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const dateRef = useRef<DateFieldHandle>(null);
  const isSelectedToday = selectedDate === dayjs().format("YYYY-MM-DD");
  const isSelectedYesterday = selectedDate === dayjs().subtract(1, "day").format("YYYY-MM-DD");

  const currency = data.settings.currency;
  const businessName = data.settings.businessName;

  // -------- KPIs for selected date --------
  const dayStats = useMemo(() => {
    const salesOnDay = data.sales.filter(
      (s) => dayjs(s.date).format("YYYY-MM-DD") === selectedDate,
    );
    const totalAmount = salesOnDay.reduce((a, s) => a + s.total, 0);
    const totalQty = salesOnDay.reduce((a, s) => a + s.quantityKg, 0);
    const customerIds = new Set(salesOnDay.map((s) => s.customerId));
    const receivedOnDay =
      salesOnDay.reduce((a, s) => a + s.initialReceived, 0) +
      data.payments
        .filter((p) => dayjs(p.date).format("YYYY-MM-DD") === selectedDate)
        .reduce((a, p) => a + p.amount, 0);
    const purchaseOnDay = data.traderBills.filter(
      (b) => dayjs(b.date).format("YYYY-MM-DD") === selectedDate,
    );
    const purchaseAmount = purchaseOnDay.reduce((a, b) => a + b.amount, 0);
    return {
      totalAmount,
      totalQty,
      salesCount: salesOnDay.length,
      customerCount: customerIds.size,
      receivedOnDay,
      purchaseAmount,
      purchaseCount: purchaseOnDay.length,
    };
  }, [data, selectedDate]);

  // Global figures (all-time)
  const globals = useMemo(() => {
    const totalPending = data.sales.reduce((a, s) => a + Math.max(0, s.total - s.received), 0);
    const pendingCustomerIds = new Set<string>();
    data.sales.forEach((s) => {
      if (s.total - s.received > 0.0001) pendingCustomerIds.add(s.customerId);
    });
    const purchaseUnpaid = data.traderBills
      .filter((b) => !b.paid)
      .reduce((a, b) => a + b.amount, 0);
    return {
      totalPending,
      pendingCustomers: pendingCustomerIds.size,
      totalCustomers: data.customers.length,
      purchaseUnpaid,
    };
  }, [data]);

  // Orders scoped to the selected day + the day after (relative view)
  const dayOrders = useMemo(() => {
    const next = dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD");
    const onSelected = data.orders.filter(
      (o) =>
        o.deliveryDate === selectedDate &&
        o.status !== "cancelled" &&
        o.status !== "completed",
    );
    const onNext = data.orders.filter(
      (o) =>
        o.deliveryDate === next &&
        o.status !== "cancelled" &&
        o.status !== "completed",
    );
    return { onSelected: onSelected.length, onNext: onNext.length, next };
  }, [data.orders, selectedDate]);

  const upcoming = useMemo(
    () =>
      data.orders
        .filter((o) => o.status !== "cancelled" && o.status !== "completed")
        .filter((o) => isToday(o.deliveryDate) || isTomorrow(o.deliveryDate))
        .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)),
    [data.orders],
  );

  // Human labels for KPI titles
  const dayLabel = isSelectedToday
    ? "Today"
    : isSelectedYesterday
      ? "Yesterday"
      : dayjs(selectedDate).format("DD MMM");
  const salesLabel = isSelectedToday ? "TODAY'S SALES" : `SALES · ${dayjs(selectedDate).format("DD MMM YYYY").toUpperCase()}`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <Label>Welcome back</Label>
        <H1 style={{ marginTop: spacing.xs }} testID="dashboard-business-name">
          {businessName}
        </H1>

        {/* Selectable date pill */}
        <View style={{ marginTop: spacing.sm }}>
          <DateField
            ref={dateRef}
            label=""
            value={selectedDate}
            onChange={setSelectedDate}
            testID="dashboard-date"
          />
        </View>
        {!isSelectedToday ? (
          <Pressable
            testID="dashboard-reset-today"
            onPress={() => setSelectedDate(dayjs().format("YYYY-MM-DD"))}
            hitSlop={10}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              marginTop: -spacing.md,
              marginBottom: spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: theme.brandPrimary, fontWeight: "700", fontSize: fontSize.sm }}>
              ← Back to today
            </Text>
          </Pressable>
        ) : null}

        {/* Hero — selected date summary (tap to change date) */}
        <Pressable
          testID="dashboard-hero-press"
          onPress={() => dateRef.current?.open()}
          style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
        >
        <Card
          style={{
            backgroundColor: theme.brandPrimary,
            borderColor: theme.brandPrimary,
          }}
          testID="dashboard-hero"
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: fontSize.sm,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                flex: 1,
              }}
            >
              {salesLabel}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: "rgba(255,255,255,0.18)",
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                borderRadius: radius.pill,
              }}
            >
              <Ionicons name="calendar-outline" size={13} color="#FFF" />
              <Text style={{ color: "#FFF", fontSize: fontSize.xs, fontWeight: "700" }}>
                Change date
              </Text>
            </View>
          </View>
          <Text
            testID="dashboard-today-sales"
            style={{
              color: theme.onBrandPrimary,
              fontSize: 38,
              fontWeight: "800",
              marginTop: 2,
              letterSpacing: -1,
            }}
          >
            {money(dayStats.totalAmount, currency)}
          </Text>
          <View style={{ flexDirection: "row", marginTop: spacing.md, gap: spacing.xl }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: "rgba(255,255,255,0.75)", fontSize: fontSize.sm, fontWeight: "600" }}
              >
                Sold {dayLabel}
              </Text>
              <Text
                testID="dashboard-today-quantity"
                style={{ color: theme.onBrandPrimary, fontSize: fontSize.xl, fontWeight: "800" }}
              >
                {kg(dayStats.totalQty)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: "rgba(255,255,255,0.75)", fontSize: fontSize.sm, fontWeight: "600" }}
              >
                Customers
              </Text>
              <Text
                testID="dashboard-total-customers"
                style={{ color: theme.onBrandPrimary, fontSize: fontSize.xl, fontWeight: "800" }}
              >
                {dayStats.customerCount}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", marginTop: spacing.md, gap: spacing.xl }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: fontSize.sm, fontWeight: "600" }}>
                Sales Count
              </Text>
              <Text style={{ color: theme.onBrandPrimary, fontSize: fontSize.md, fontWeight: "700" }}>
                {dayStats.salesCount}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: fontSize.sm, fontWeight: "600" }}>
                Received
              </Text>
              <Text style={{ color: theme.onBrandPrimary, fontSize: fontSize.md, fontWeight: "700" }}>
                {money(dayStats.receivedOnDay, currency)}
              </Text>
            </View>
          </View>
        </Card>
        </Pressable>

        {/* Pending strip (all-time) */}
        <Pressable
          testID="dashboard-pending-card"
          onPress={() => router.push("/(tabs)/pending")}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginTop: spacing.md })}
        >
          <Card
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: globals.totalPending > 0 ? "#FDECEA" : theme.brandTertiary,
              borderColor: globals.totalPending > 0 ? "#F5C6CB" : theme.brandSecondary,
            }}
          >
            <View
              style={{
                height: 44,
                width: 44,
                borderRadius: radius.pill,
                backgroundColor: globals.totalPending > 0 ? theme.error : theme.brandPrimary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons
                name={globals.totalPending > 0 ? "cash-clock" : "check-decagram"}
                size={22}
                color="#FFF"
              />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ color: theme.muted, fontSize: fontSize.sm, fontWeight: "700" }}>
                {globals.totalPending > 0 ? "CUSTOMERS OWE YOU" : "ALL CLEAR"}
              </Text>
              <Text
                testID="dashboard-total-pending"
                style={{
                  color: globals.totalPending > 0 ? theme.error : theme.onBrandTertiary,
                  fontSize: fontSize.xxl,
                  fontWeight: "800",
                }}
              >
                {money(globals.totalPending, currency)}
              </Text>
              <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                {globals.pendingCustomers} pending customer
                {globals.pendingCustomers === 1 ? "" : "s"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={theme.muted} />
          </Card>
        </Pressable>

        {/* You Owe Traders */}
        <Pressable
          testID="dashboard-owe-card"
          onPress={() => router.push("/purchase")}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginTop: spacing.md })}
        >
          <Card style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                height: 44,
                width: 44,
                borderRadius: radius.pill,
                backgroundColor: globals.purchaseUnpaid > 0 ? theme.warning : theme.brandTertiary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons
                name="file-image-outline"
                size={22}
                color={globals.purchaseUnpaid > 0 ? "#FFF" : theme.brandPrimary}
              />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ color: theme.muted, fontSize: fontSize.sm, fontWeight: "700" }}>
                YOU OWE TRADERS
              </Text>
              <Text
                testID="dashboard-you-owe"
                style={{
                  color: globals.purchaseUnpaid > 0 ? theme.warning : theme.onSurface,
                  fontSize: fontSize.xxl,
                  fontWeight: "800",
                }}
              >
                {money(globals.purchaseUnpaid, currency)}
              </Text>
              <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                Purchase bills · tap to manage
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={theme.muted} />
          </Card>
        </Pressable>

        {/* Order counts scoped to selected day */}
        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
          <Card style={{ flex: 1 }} testID="dashboard-today-orders">
            <Label>{isSelectedToday ? "Today's Orders" : `${dayLabel}'s Orders`}</Label>
            <H1 style={{ marginTop: spacing.xs }}>{dayOrders.onSelected}</H1>
          </Card>
          <Card style={{ flex: 1 }} testID="dashboard-tomorrow-orders">
            <Label>{isSelectedToday ? "Tomorrow" : "Next Day"}</Label>
            <H1 style={{ marginTop: spacing.xs }}>{dayOrders.onNext}</H1>
          </Card>
        </View>

        {/* Quick actions */}
        <H2 style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Quick Actions</H2>
        <View style={styles.grid}>
          <QuickAction
            label="New Sale"
            tone="primary"
            testID="qa-new-sale"
            icon={<Ionicons name="add" size={22} color="#FFF" />}
            onPress={() => router.push("/(tabs)/sale")}
          />
          <QuickAction
            label="Pending"
            testID="qa-pending"
            icon={<MaterialCommunityIcons name="cash-clock" size={22} color={theme.brandPrimary} />}
            onPress={() => router.push("/(tabs)/pending")}
          />
          <QuickAction
            label="Upcoming Orders"
            testID="qa-orders"
            icon={<MaterialCommunityIcons name="clipboard-list-outline" size={22} color={theme.brandPrimary} />}
            onPress={() => router.push("/(tabs)/orders")}
          />
          <QuickAction
            label="Purchase Bills"
            testID="qa-purchase"
            icon={<MaterialCommunityIcons name="file-image-outline" size={22} color={theme.brandPrimary} />}
            onPress={() => router.push("/purchase")}
          />
          <QuickAction
            label="Customers"
            testID="qa-customers"
            icon={<Ionicons name="people-outline" size={22} color={theme.brandPrimary} />}
            onPress={() => router.push("/customer")}
          />
          <QuickAction
            label="Reports"
            testID="qa-reports"
            icon={<MaterialCommunityIcons name="chart-line" size={22} color={theme.brandPrimary} />}
            onPress={() => router.push("/reports")}
          />
        </View>

        {/* Upcoming orders preview */}
        <View style={{ marginTop: spacing.xl, flexDirection: "row", alignItems: "center" }}>
          <H2 style={{ flex: 1 }}>Upcoming</H2>
          <Pressable
            testID="see-all-orders"
            onPress={() => router.push("/(tabs)/orders")}
            hitSlop={10}
          >
            <Text style={{ color: theme.brandPrimary, fontWeight: "700" }}>See all</Text>
          </Pressable>
        </View>

        {upcoming.length === 0 ? (
          <Card style={{ marginTop: spacing.md, alignItems: "center", paddingVertical: spacing.xl }}>
            <MaterialCommunityIcons
              name="clipboard-outline"
              size={32}
              color={theme.muted}
              style={{ marginBottom: spacing.sm }}
            />
            <Body muted>No upcoming orders</Body>
          </Card>
        ) : (
          upcoming.slice(0, 5).map((o) => (
            <Pressable
              key={o.id}
              testID={`dashboard-order-${o.id}`}
              onPress={() => router.push(`/order/${o.id}`)}
            >
              <Card style={{ marginTop: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "700" }}
                    >
                      {o.customerName}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                      {kg(o.quantityKg)} · {money(o.estimatedTotal, currency)} · {fmtDateShort(o.deliveryDate)}
                      {o.deliveryTime ? ` at ${o.deliveryTime}` : ""}
                    </Text>
                  </View>
                  <Badge
                    label={
                      isToday(o.deliveryDate)
                        ? "Today"
                        : isTomorrow(o.deliveryDate)
                          ? "Tomorrow"
                          : o.status
                    }
                    tone={isToday(o.deliveryDate) ? "warning" : "info"}
                  />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  quickAction: {
    width: "48%",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
