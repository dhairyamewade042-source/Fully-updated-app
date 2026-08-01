import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { PurchaseForm } from "@/src/components/PurchaseForm";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { showToast } from "@/src/components/Toast";
import { useApp } from "@/src/context/AppContext";

export default function NewPurchaseScreen() {
  const { theme, addTraderBill } = useApp();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader title="New Purchase Bill" subtitle="Log a bill from your trader" showBack />
      <PurchaseForm
        submitLabel="Save Bill"
        onSubmit={async (v) => {
          await addTraderBill(v);
          showToast("Bill saved");
          router.back();
        }}
      />
    </View>
  );
}
