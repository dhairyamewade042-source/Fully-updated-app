// New Sale — high-speed data entry with auto-calc totals.

import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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

import { DateField } from "@/src/components/DateField";
import { Field } from "@/src/components/Field";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { showToast } from "@/src/components/Toast";
import { Body, Button, Card, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fontSize, radius, spacing } from "@/src/lib/theme";
import { money } from "@/src/lib/format";

export default function NewSaleScreen() {
  const { theme, data, addSale } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{
    customerName?: string;
    phone?: string;
    quantityKg?: string;
    pricePerKg?: string;
    orderId?: string;
  }>();
  const insets = useSafeAreaInsets();

  const [dateISO, setDateISO] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [received, setReceived] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  // Prefill from Convert-to-Sale flow
  useEffect(() => {
    if (params.customerName) setCustomerName(String(params.customerName));
    if (params.phone) setPhone(String(params.phone));
    if (params.quantityKg) setQuantity(String(params.quantityKg));
    if (params.pricePerKg) setPrice(String(params.pricePerKg));
  }, [params.customerName, params.phone, params.quantityKg, params.pricePerKg]);

  const q = parseFloat(quantity) || 0;
  const p = parseFloat(price) || 0;
  const total = +(q * p).toFixed(2);
  const r = Math.max(0, Math.min(parseFloat(received) || 0, total));
  const remaining = +(total - r).toFixed(2);

  const paymentStatus =
    total <= 0
      ? "—"
      : remaining <= 0.0001
        ? "Paid"
        : r <= 0.0001
          ? "Unpaid"
          : "Partial";

  const paymentStatusTone: "success" | "error" | "warning" | "info" =
    total <= 0 ? "info" : remaining <= 0.0001 ? "success" : r <= 0.0001 ? "error" : "warning";

  const currency = data.settings.currency;

  const suggestions = useMemo(() => {
    if (!customerName.trim() || !suggestOpen) return [];
    const q2 = customerName.trim().toLowerCase();
    return data.customers
      .filter((c) => c.name.toLowerCase().includes(q2))
      .slice(0, 5);
  }, [customerName, data.customers, suggestOpen]);

  const canSave = customerName.trim().length > 0 && q > 0 && p > 0;

  const onSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await addSale({
        customerName: customerName.trim(),
        phone: phone.trim() || undefined,
        date: dayjs(dateISO).toISOString(),
        quantityKg: q,
        pricePerKg: p,
        received: r,
      });
      const msg =
        remaining > 0.0001
          ? `Sale saved. ${money(remaining, currency)} added to pending.`
          : "Sale saved. Fully paid ✓";
      showToast(msg, "success");
      // reset form
      setCustomerName("");
      setPhone("");
      setQuantity("");
      setPrice("");
      setReceived("");
      setDateISO(dayjs().format("YYYY-MM-DD"));
      router.push("/(tabs)");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader title="New Sale" subtitle="Enter today's transaction" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: 140 + insets.bottom,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Date row */}
          <DateField
            label="Sale Date"
            value={dateISO}
            onChange={setDateISO}
            testID="sale-date"
          />

          <Field
            label="Customer Name"
            testID="sale-customer"
            value={customerName}
            onChangeText={(v) => {
              setCustomerName(v);
              setSuggestOpen(true);
            }}
            placeholder="e.g. Ramesh"
            autoCapitalize="words"
          />

          {suggestions.length > 0 ? (
            <View style={{ marginTop: -spacing.md, marginBottom: spacing.md }}>
              {suggestions.map((c) => (
                <Pressable
                  key={c.id}
                  testID={`sale-suggest-${c.id}`}
                  onPress={() => {
                    setCustomerName(c.name);
                    if (c.phone) setPhone(c.phone);
                    setSuggestOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.suggestion,
                    {
                      backgroundColor: theme.brandTertiary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons name="person-outline" size={16} color={theme.onBrandTertiary} />
                  <Text
                    style={{
                      color: theme.onBrandTertiary,
                      marginLeft: spacing.sm,
                      fontWeight: "700",
                    }}
                  >
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Field
            label="Mobile Number (Optional)"
            testID="sale-phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit number"
            keyboardType="phone-pad"
          />

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Quantity (kg)"
                testID="sale-quantity"
                value={quantity}
                onChangeText={setQuantity}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={`Price per kg (${currency})`}
                testID="sale-price"
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Summary card */}
          <Card
            style={{
              backgroundColor: theme.brandTertiary,
              borderColor: theme.brandSecondary,
            }}
            testID="sale-summary"
          >
            <View style={styles.rowBetween}>
              <Label>Total Amount</Label>
              <Text
                testID="sale-total"
                style={{ color: theme.onBrandTertiary, fontSize: fontSize.xxl, fontWeight: "800" }}
              >
                {money(total, currency)}
              </Text>
            </View>
          </Card>

          <View style={{ height: spacing.lg }} />
          <Field
            label={`Amount Received (${currency})`}
            testID="sale-received"
            value={received}
            onChangeText={setReceived}
            placeholder="0"
            keyboardType="decimal-pad"
            hint={total > 0 ? "Tip: leave 0 for a fully-pending bill" : undefined}
          />

          <Card testID="sale-remaining" style={{ marginTop: -spacing.xs }}>
            <View style={styles.rowBetween}>
              <View>
                <Label>Remaining</Label>
                <Text
                  style={{
                    color: remaining > 0 ? theme.error : theme.brandPrimary,
                    fontSize: fontSize.xxl,
                    fontWeight: "800",
                    marginTop: 2,
                  }}
                >
                  {money(remaining, currency)}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                  borderRadius: radius.pill,
                  backgroundColor:
                    paymentStatusTone === "success"
                      ? theme.brandTertiary
                      : paymentStatusTone === "error"
                        ? "#FDECEA"
                        : paymentStatusTone === "warning"
                          ? "#FFF3CD"
                          : theme.border,
                }}
              >
                <Text
                  testID="sale-status"
                  style={{
                    fontWeight: "800",
                    color:
                      paymentStatusTone === "success"
                        ? theme.onBrandTertiary
                        : paymentStatusTone === "error"
                          ? theme.error
                          : paymentStatusTone === "warning"
                            ? "#8A5A00"
                            : theme.onSurface,
                  }}
                >
                  {paymentStatus}
                </Text>
              </View>
            </View>
            {remaining > 0.0001 ? (
              <Body muted style={{ marginTop: spacing.sm }}>
                This customer will be added to Pending Payments automatically.
              </Body>
            ) : null}
          </Card>
        </ScrollView>

        {/* Sticky CTA */}
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
            label="Save Sale"
            onPress={onSave}
            disabled={!canSave}
            loading={saving}
            fullWidth
            testID="sale-save"
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  ctaWrap: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
