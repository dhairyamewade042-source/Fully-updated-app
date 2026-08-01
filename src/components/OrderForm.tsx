// Shared order form used by /order/new and /order/[id] (edit mode).

import dayjs from "dayjs";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateField } from "@/src/components/DateField";
import { Field } from "@/src/components/Field";
import { showToast } from "@/src/components/Toast";
import { Body, Button, Card, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { money } from "@/src/lib/format";
import { fontSize, radius, spacing } from "@/src/lib/theme";
import { Order, OrderStatus } from "@/src/lib/types";

const STATUSES: OrderStatus[] = ["pending", "confirmed", "completed", "cancelled"];

export const OrderForm = ({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial?: Partial<Order>;
  onSubmit: (values: {
    customerName: string;
    phone?: string;
    orderDate: string;
    deliveryDate: string;
    deliveryTime?: string;
    quantityKg: number;
    expectedPricePerKg: number;
    address?: string;
    notes?: string;
    status: OrderStatus;
  }) => Promise<void>;
  submitLabel: string;
}) => {
  const { theme, data } = useApp();
  const insets = useSafeAreaInsets();
  const currency = data.settings.currency;

  const [customerName, setCustomerName] = useState(initial?.customerName || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [orderDate] = useState(initial?.orderDate || new Date().toISOString());
  const [deliveryDate, setDeliveryDate] = useState(
    initial?.deliveryDate || dayjs().add(1, "day").format("YYYY-MM-DD"),
  );
  const [deliveryTime, setDeliveryTime] = useState(initial?.deliveryTime || "");
  const [quantity, setQuantity] = useState(
    initial?.quantityKg ? String(initial.quantityKg) : "",
  );
  const [price, setPrice] = useState(
    initial?.expectedPricePerKg ? String(initial.expectedPricePerKg) : "",
  );
  const [address, setAddress] = useState(initial?.address || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [status, setStatus] = useState<OrderStatus>(initial?.status || "pending");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const q = parseFloat(quantity) || 0;
  const p = parseFloat(price) || 0;
  const total = +(q * p).toFixed(2);

  const suggestions = useMemo(() => {
    if (!customerName.trim() || !suggestOpen) return [];
    const q2 = customerName.trim().toLowerCase();
    return data.customers.filter((c) => c.name.toLowerCase().includes(q2)).slice(0, 5);
  }, [customerName, data.customers, suggestOpen]);

  const canSave = customerName.trim().length > 0 && q > 0 && p > 0 && deliveryDate;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        customerName: customerName.trim(),
        phone: phone.trim() || undefined,
        orderDate,
        deliveryDate,
        deliveryTime: deliveryTime.trim() || undefined,
        quantityKg: q,
        expectedPricePerKg: p,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
      });
    } catch (e: any) {
      showToast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={20}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          label="Customer Name"
          value={customerName}
          onChangeText={(v) => {
            setCustomerName(v);
            setSuggestOpen(true);
          }}
          autoCapitalize="words"
          placeholder="e.g. Ramesh"
          testID="order-customer"
        />
        {suggestions.length > 0 ? (
          <View style={{ marginTop: -spacing.md, marginBottom: spacing.md }}>
            {suggestions.map((c) => (
              <Pressable
                key={c.id}
                testID={`order-suggest-${c.id}`}
                onPress={() => {
                  setCustomerName(c.name);
                  if (c.phone) setPhone(c.phone);
                  setSuggestOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: theme.brandTertiary,
                  marginBottom: spacing.xs,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: theme.onBrandTertiary, fontWeight: "700" }}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Field
          label="Phone (Optional)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          testID="order-phone"
        />

        <DateField label="Delivery Date" value={deliveryDate} onChange={setDeliveryDate} testID="order-delivery-date" />

        <Field
          label="Delivery Time (Optional)"
          value={deliveryTime}
          onChangeText={setDeliveryTime}
          placeholder="e.g. 10:30 AM"
          testID="order-delivery-time"
        />

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Quantity (kg)"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
              testID="order-quantity"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={`Expected Price/kg (${currency})`}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              testID="order-price"
            />
          </View>
        </View>

        <Card
          style={{
            backgroundColor: theme.brandTertiary,
            borderColor: theme.brandSecondary,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Label>Estimated Total</Label>
            <Text
              testID="order-estimated-total"
              style={{ color: theme.onBrandTertiary, fontSize: fontSize.xxl, fontWeight: "800" }}
            >
              {money(total, currency)}
            </Text>
          </View>
        </Card>

        <View style={{ height: spacing.lg }} />
        <Field
          label="Address (Optional)"
          value={address}
          onChangeText={setAddress}
          placeholder="Where to deliver?"
          multiline
          testID="order-address"
        />
        <Field
          label="Notes (Optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Any special instructions"
          multiline
          testID="order-notes"
        />

        <Label>Status</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
          {STATUSES.map((s) => {
            const active = status === s;
            return (
              <Pressable
                key={s}
                testID={`order-status-${s}`}
                onPress={() => setStatus(s)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.md,
                  height: 34,
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
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Body muted style={{ marginTop: spacing.md, fontSize: fontSize.sm }}>
          Order created on {dayjs(orderDate).format("DD MMM YYYY")}
        </Body>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.divider,
        }}
      >
        <Button
          label={submitLabel}
          onPress={save}
          disabled={!canSave}
          loading={saving}
          fullWidth
          testID="order-submit"
        />
      </View>
    </KeyboardAvoidingView>
  );
};
