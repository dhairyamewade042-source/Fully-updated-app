import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { PurchaseForm } from "@/src/components/PurchaseForm";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { showToast } from "@/src/components/Toast";
import { Body } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { spacing } from "@/src/lib/theme";

export default function PurchaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme, data, updateTraderBill, deleteTraderBill } = useApp();
  const bill = data.traderBills.find((b) => b.id === String(id));

  if (!bill) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.surface }}>
        <ScreenHeader title="Purchase Bill" showBack />
        <Body muted style={{ padding: spacing.lg }}>
          Bill not found.
        </Body>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader title={bill.traderName} subtitle={bill.paid ? "Paid" : "Unpaid"} showBack />
      <PurchaseForm
        initial={bill}
        submitLabel="Save Changes"
        onSubmit={async (v) => {
          await updateTraderBill(bill.id, v);
          showToast("Bill updated");
          router.back();
        }}
        onDelete={async () => {
          await deleteTraderBill(bill.id);
          showToast("Bill deleted", "info");
          router.back();
        }}
      />
    </View>
  );
}
