// Pending Payments — customer-grouped list with FIFO details.

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { showToast } from "@/src/components/Toast";
import { Body, Card, EmptyState } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fmtDateShort, kg, money } from "@/src/lib/format";
import { fontSize, radius, spacing } from "@/src/lib/theme";
import { openWhatsApp, paymentReminder } from "@/src/lib/whatsapp";

export default function PendingScreen() {
  const { theme, data, customerBills } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const currency = data.settings.currency;

  const rows = useMemo(() => {
    const map = new Map<
      string,
      {
        customerId: string;
        name: string;
        phone?: string;
        pendingTotal: number;
        pendingQuantity: number;
        billCount: number;
      }
    >();
    data.sales.forEach((s) => {
      const owed = s.total - s.received;
      if (owed <= 0.0001) return;
      const prev = map.get(s.customerId);
      if (prev) {
        prev.pendingTotal += owed;
        prev.pendingQuantity += s.quantityKg;
        prev.billCount += 1;
      } else {
        const c = data.customers.find((x) => x.id === s.customerId);
        map.set(s.customerId, {
          customerId: s.customerId,
          name: c?.name || s.customerName,
          phone: c?.phone,
          pendingTotal: owed,
          pendingQuantity: s.quantityKg,
          billCount: 1,
        });
      }
    });
    const all = Array.from(map.values()).sort((a, b) => b.pendingTotal - a.pendingTotal);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.phone || "").includes(q),
    );
  }, [data.sales, data.customers, query]);

  const grandTotal = rows.reduce((a, r) => a + r.pendingTotal, 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader title="Pending Payments" subtitle={`${rows.length} customer${rows.length === 1 ? "" : "s"} · ${money(grandTotal, currency)}`} />

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
            testID="pending-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or phone"
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
        keyExtractor={(r) => r.customerId}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 120 + insets.bottom,
        }}
        ListEmptyComponent={
          <EmptyState
            title="No pending payments"
            subtitle="Every customer is up to date. New unpaid sales will show up here automatically."
            icon={<Ionicons name="checkmark-done" size={30} color={theme.brandPrimary} />}
          />
        }
        renderItem={({ item }) => {
          const bills = customerBills(item.customerId).filter((b) => b.total - b.received > 0.0001);
          const preview = bills.slice(0, 2);
          return (
            <Pressable
              testID={`pending-customer-${item.customerId}`}
              onPress={() => router.push(`/customer/${item.customerId}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800" }}
                    >
                      {item.name}
                    </Text>
                    {item.phone ? (
                      <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                        {item.phone}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{ color: theme.error, fontSize: fontSize.xxl, fontWeight: "800" }}
                    >
                      {money(item.pendingTotal, currency)}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>
                      {item.billCount} bill{item.billCount === 1 ? "" : "s"} · {kg(item.pendingQuantity)}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    marginTop: spacing.md,
                    paddingTop: spacing.md,
                    borderTopWidth: 1,
                    borderTopColor: theme.divider,
                  }}
                >
                  {preview.map((b, idx) => {
                    const pending = b.total - b.received;
                    return (
                      <View
                        key={b.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: idx === preview.length - 1 ? 0 : spacing.sm,
                        }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: theme.error,
                            marginRight: spacing.sm,
                          }}
                        />
                        <Text style={{ color: theme.muted, fontSize: fontSize.sm, flex: 1 }}>
                          {fmtDateShort(b.date)} · {kg(b.quantityKg)} @ {money(b.pricePerKg, currency)}
                        </Text>
                        <Text
                          style={{ color: theme.error, fontSize: fontSize.md, fontWeight: "700" }}
                        >
                          {money(pending, currency)}
                        </Text>
                      </View>
                    );
                  })}
                  {bills.length > preview.length ? (
                    <Body muted style={{ marginTop: spacing.xs, fontSize: fontSize.sm }}>
                      +{bills.length - preview.length} more bill{bills.length - preview.length === 1 ? "" : "s"}
                    </Body>
                  ) : null}
                </View>

                <View style={{ flexDirection: "row", marginTop: spacing.md, gap: spacing.sm }}>
                  <Pressable
                    testID={`pending-receive-${item.customerId}`}
                    onPress={() => router.push(`/receive-payment/${item.customerId}`)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      {
                        backgroundColor: theme.brandPrimary,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="cash-plus" size={18} color="#FFF" />
                    <Text style={{ color: "#FFF", fontWeight: "700", marginLeft: spacing.xs }}>
                      Receive
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`pending-whatsapp-${item.customerId}`}
                    disabled={!item.phone}
                    onPress={async () => {
                      const oldest = bills[0];
                      const ok = await openWhatsApp(
                        item.phone,
                        paymentReminder({
                          businessName: data.settings.businessName,
                          customerName: item.name,
                          pendingAmount: item.pendingTotal.toLocaleString("en-IN", {
                            maximumFractionDigits: 2,
                          }),
                          currency,
                          oldestPendingDate: oldest ? fmtDateShort(oldest.date) : undefined,
                        }),
                      );
                      if (!ok) showToast("Couldn't open WhatsApp", "error");
                    }}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      {
                        backgroundColor: "#25D366",
                        opacity: pressed ? 0.85 : item.phone ? 1 : 0.4,
                      },
                    ]}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
                    <Text style={{ color: "#FFF", fontWeight: "700", marginLeft: spacing.xs }}>
                      Remind
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`pending-view-${item.customerId}`}
                    onPress={() => router.push(`/customer/${item.customerId}`)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      {
                        backgroundColor: theme.brandTertiary,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="receipt-outline" size={18} color={theme.onBrandTertiary} />
                    <Text
                      style={{ color: theme.onBrandTertiary, fontWeight: "700", marginLeft: spacing.xs }}
                    >
                      Ledger
                    </Text>
                  </Pressable>
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
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
