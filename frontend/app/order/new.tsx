import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { OrderForm } from "@/src/components/OrderForm";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { showToast } from "@/src/components/Toast";
import { useApp } from "@/src/context/AppContext";

export default function NewOrderScreen() {
  const { theme, addOrder } = useApp();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader title="New Order" subtitle="Booking for a future delivery" showBack />
      <OrderForm
        submitLabel="Save Order"
        onSubmit={async (v) => {
          await addOrder(v);
          showToast("Order saved");
          router.back();
        }}
      />
    </View>
  );
}
