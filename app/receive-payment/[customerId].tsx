// Receive Payment — full-screen form scoped to a customer, FIFO preview.

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Field } from "@/src/components/Field";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { showToast } from "@/src/components/Toast";
import { Body, Button, Card, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fmtDateShort, kg, money } from "@/src/lib/format";
import { fontSize, radius, spacing } from "@/src/lib/theme";

export default function ReceivePaymentScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    theme,
    data,
    getCustomer,
    pendingBills,
    customerBalance,
    receivePayment,
  } = useApp();
  const currency = data.settings.currency;
  const customer = customerId ? getCustomer(String(customerId)) : undefined;

  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = customer ? customerBalance(customer.id) : 0;
  const bills = useMemo(() => (customer ? pendingBills(customer.id) : []), [customer, pendingBills]);

  const value = parseFloat(amount) || 0;

  // Preview FIFO allocation without mutating state.
  const preview = useMemo(() => {
    let remaining = value;
    return bills.map((b) => {
      const owed = b.total - b.received;
      const take = Math.max(0, Math.min(owed, remaining));
      remaining = Math.max(0, remaining - take);
      const clearedAfter = owed - take <= 0.0001;
      return { bill: b, take, owed, clearedAfter };
    });
  }, [bills, value]);

  const remainingAfter = Math.max(0, pending - value);

  if (!customer) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.surface }}>
        <ScreenHeader title="Receive Payment" showBack />
        <Body muted style={{ padding: spacing.lg }}>
          Customer not found.
        </Body>
      </View>
    );
  }

  const canSave = value > 0 && value <= pending + 0.0001;

  const onSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await receivePayment(customer.id, value);
      showToast(`Payment of ${money(value, currency)} received`, "success");
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const quickAmount = (v: number) => setAmount(String(Math.round(v)));

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader title="Receive Payment" subtitle={customer.name} showBack />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          <Card
            style={{
              backgroundColor: "#FDECEA",
              borderColor: "#F5C6CB",
            }}
          >
            <Label>Total Pending</Label>
            <Text
              style={{
                color: theme.error,
                fontSize: 34,
                fontWeight: "800",
                marginTop: 2,
                letterSpacing: -0.5,
              }}
            >
              {money(pending, currency)}
            </Text>
            <Body muted style={{ marginTop: 4 }}>
              {bills.length} unpaid bill{bills.length === 1 ? "" : "s"}
            </Body>
          </Card>

          <View style={{ height: spacing.lg }} />
          <Field
            label={`Amount Received (${currency})`}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoFocus
            testID="receive-amount"
          />

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.md }}>
            <Pressable
              testID="quick-half"
              onPress={() => quickAmount(pending / 2)}
              style={({ pressed }) => [styles.quick, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={{ color: theme.onSurface, fontWeight: "700" }}>Half</Text>
            </Pressable>
            <Pressable
              testID="quick-full"
              onPress={() => quickAmount(pending)}
              style={({ pressed }) => [styles.quick, { backgroundColor: theme.brandTertiary, borderColor: theme.brandSecondary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={{ color: theme.onBrandTertiary, fontWeight: "700" }}>Clear all</Text>
            </Pressable>
          </View>

          {value > 0 ? (
            <Card testID="receive-preview">
              <Label>FIFO Allocation Preview</Label>
              {preview.map(({ bill, take, owed, clearedAfter }) => (
                <View
                  key={bill.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: theme.divider,
                    marginTop: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      height: 28,
                      width: 28,
                      borderRadius: radius.pill,
                      backgroundColor: take > 0 ? theme.brandTertiary : theme.border,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: spacing.md,
                    }}
                  >
                    {take > 0 ? (
                      <MaterialCommunityIcons
                        name={clearedAfter ? "check-all" : "check"}
                        size={16}
                        color={theme.onBrandTertiary}
                      />
                    ) : (
                      <Text style={{ color: theme.muted, fontWeight: "800" }}>—</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: "700" }}>{fmtDateShort(bill.date)}</Text>
                    <Text style={{ color: theme.muted, fontSize: fontSize.sm }}>
                      Owed {money(owed, currency)} · {kg(bill.quantityKg)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        color: take > 0 ? theme.brandPrimary : theme.muted,
                        fontWeight: "800",
                      }}
                    >
                      {take > 0 ? `-${money(take, currency)}` : "—"}
                    </Text>
                    {clearedAfter && take > 0 ? (
                      <Text style={{ color: theme.brandPrimary, fontSize: fontSize.xs, fontWeight: "700" }}>
                        CLEARED
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingTop: spacing.md,
                  marginTop: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: theme.divider,
                }}
              >
                <Text style={{ color: theme.onSurface, fontWeight: "800", fontSize: fontSize.md }}>
                  Remaining after
                </Text>
                <Text
                  style={{
                    color: remainingAfter > 0 ? theme.error : theme.brandPrimary,
                    fontWeight: "800",
                    fontSize: fontSize.md,
                  }}
                >
                  {money(remainingAfter, currency)}
                </Text>
              </View>
            </Card>
          ) : (
            <Body muted style={{ marginTop: spacing.sm }}>
              Enter an amount to preview which bills will be cleared.
            </Body>
          )}
        </ScrollView>

        <View
          style={[
            styles.ctaWrap,
            {
              paddingBottom: insets.bottom + spacing.md,
              backgroundColor: theme.surface,
              borderTopColor: theme.divider,
            },
          ]}
        >
          <Button
            label="Confirm Payment"
            onPress={onSave}
            disabled={!canSave}
            loading={saving}
            fullWidth
            icon={<Ionicons name="checkmark" size={20} color="#FFF" />}
            testID="confirm-payment"
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  quick: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaWrap: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
