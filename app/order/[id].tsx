// Order Detail — read-only view + quick actions + edit modal + Convert to Sale.

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OrderForm } from "@/src/components/OrderForm";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { showToast } from "@/src/components/Toast";
import { Badge, Body, Button, Card, Label } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { useApp } from "@/src/context/AppContext";
import { fmtDate, kg, money } from "@/src/lib/format";
import { fontSize, radius, spacing } from "@/src/lib/theme";
import { OrderStatus } from "@/src/lib/types";

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

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    theme,
    data,
    updateOrder,
    deleteOrder,
    duplicateOrder,
    convertOrderToSale,
  } = useApp();
  const currency = data.settings.currency;
  const order = data.orders.find((o) => o.id === String(id));
  const [editing, setEditing] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertReceived, setConvertReceived] = useState("");

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.surface }}>
        <ScreenHeader title="Order" showBack />
        <Body muted style={{ padding: spacing.lg }}>
          Order not found.
        </Body>
      </View>
    );
  }

  const doComplete = async () => {
    setConvertReceived("");
    setConvertOpen(true);
  };

  const confirmConvert = async () => {
    const rec = parseFloat(convertReceived) || 0;
    await convertOrderToSale(order.id, rec);
    setConvertOpen(false);
    showToast("Order converted to today's sale");
    router.replace("/(tabs)");
  };

  const markCompletedWithoutSale = async () => {
    await updateOrder(order.id, { status: "completed" });
    setConvertOpen(false);
    showToast("Marked as completed");
  };

  const cancelOrder = async () => {
    await updateOrder(order.id, { status: "cancelled" });
    showToast("Order cancelled", "info");
  };

  const duplicate = async () => {
    const copy = await duplicateOrder(order.id);
    if (copy) {
      showToast("Duplicated");
      router.replace(`/order/${copy.id}`);
    }
  };

  const remove = async () => {
    await deleteOrder(order.id);
    showToast("Order deleted", "info");
    router.back();
  };

  if (editing) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.surface }}>
        <ScreenHeader
          title="Edit Order"
          subtitle={order.customerName}
          showBack
          right={
            <Pressable onPress={() => setEditing(false)} hitSlop={10}>
              <Text style={{ color: theme.brandPrimary, fontWeight: "700" }}>Cancel</Text>
            </Pressable>
          }
        />
        <OrderForm
          initial={order}
          submitLabel="Update Order"
          onSubmit={async (v) => {
            await updateOrder(order.id, {
              ...v,
              estimatedTotal: +(v.quantityKg * v.expectedPricePerKg).toFixed(2),
            });
            showToast("Order updated");
            setEditing(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader
        title={order.customerName}
        subtitle={fmtDate(order.deliveryDate)}
        showBack
        right={<Badge label={order.status} tone={statusTone(order.status)} />}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 + insets.bottom }}>
        <Card>
          <View style={{ flexDirection: "row", gap: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <Label>Delivery</Label>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "700", marginTop: 2 }}>
                {fmtDate(order.deliveryDate)}
              </Text>
              {order.deliveryTime ? (
                <Text style={{ color: theme.muted, marginTop: 2 }}>{order.deliveryTime}</Text>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Label>Quantity</Label>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "700", marginTop: 2 }}>
                {kg(order.quantityKg)}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Label>Expected Price</Label>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "700", marginTop: 2 }}>
                {money(order.expectedPricePerKg, currency)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Label>Estimated Total</Label>
              <Text style={{ color: theme.brandPrimary, fontSize: fontSize.lg, fontWeight: "800", marginTop: 2 }}>
                {money(order.estimatedTotal, currency)}
              </Text>
            </View>
          </View>
          {order.phone ? (
            <View style={{ marginTop: spacing.md }}>
              <Label>Phone</Label>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "700", marginTop: 2 }}>
                {order.phone}
              </Text>
            </View>
          ) : null}
          {order.address ? (
            <View style={{ marginTop: spacing.md }}>
              <Label>Address</Label>
              <Text style={{ color: theme.onSurface, marginTop: 2 }}>{order.address}</Text>
            </View>
          ) : null}
          {order.notes ? (
            <View style={{ marginTop: spacing.md }}>
              <Label>Notes</Label>
              <Text style={{ color: theme.onSurface, marginTop: 2 }}>{order.notes}</Text>
            </View>
          ) : null}
        </Card>

        {/* Actions */}
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {order.status !== "completed" && order.status !== "cancelled" ? (
            <Button
              label="Mark as Completed"
              onPress={doComplete}
              icon={<Ionicons name="checkmark-done" size={20} color="#FFF" />}
              fullWidth
              testID="order-complete"
            />
          ) : null}
          {order.status !== "confirmed" && order.status !== "completed" && order.status !== "cancelled" ? (
            <Button
              label="Mark Confirmed"
              variant="secondary"
              onPress={async () => {
                await updateOrder(order.id, { status: "confirmed" });
                showToast("Order confirmed");
              }}
              fullWidth
              testID="order-confirm"
            />
          ) : null}

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button label="Edit" variant="secondary" onPress={() => setEditing(true)} style={{ flex: 1 }} testID="order-edit" />
            <Button label="Duplicate" variant="secondary" onPress={duplicate} style={{ flex: 1 }} testID="order-duplicate" />
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {order.status !== "cancelled" ? (
              <Button label="Cancel Order" variant="ghost" onPress={cancelOrder} style={{ flex: 1 }} testID="order-cancel" />
            ) : null}
            <Button label="Delete" variant="danger" onPress={remove} style={{ flex: 1 }} testID="order-delete" />
          </View>
        </View>
      </ScrollView>

      {/* Convert-to-Sale modal */}
      <Modal transparent animationType="fade" visible={convertOpen} onRequestClose={() => setConvertOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setConvertOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surfaceSecondary }]}>
            <Text style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800" }}>
              Convert to today's sale?
            </Text>
            <Body muted style={{ marginTop: spacing.xs }}>
              We'll auto-fill a new sale with this order's details.
            </Body>
            <View style={{ height: spacing.md }} />
            <Field
              label={`Amount Received Now (${currency})`}
              value={convertReceived}
              onChangeText={setConvertReceived}
              placeholder={`Est. total ${money(order.estimatedTotal, currency)}`}
              keyboardType="decimal-pad"
              autoFocus
              testID="convert-received"
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <Button label="Just complete" variant="ghost" onPress={markCompletedWithoutSale} style={{ flex: 1 }} testID="convert-complete-only" />
              <Button label="Convert" onPress={confirmConvert} style={{ flex: 1 }} testID="convert-confirm" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
