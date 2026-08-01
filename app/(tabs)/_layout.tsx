import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/context/AppContext";

type IconName =
  | "home"
  | "sale"
  | "pending"
  | "orders"
  | "more";

const renderIcon = (name: IconName, color: string, size: number) => {
  switch (name) {
    case "home":
      return <Ionicons name="home" size={size} color={color} />;
    case "sale":
      return <MaterialCommunityIcons name="cart-plus" size={size} color={color} />;
    case "pending":
      return <MaterialCommunityIcons name="cash-clock" size={size} color={color} />;
    case "orders":
      return <MaterialCommunityIcons name="clipboard-list-outline" size={size} color={color} />;
    case "more":
      return <Ionicons name="menu" size={size} color={color} />;
  }
};

export default function TabsLayout() {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.brandPrimary,
        tabBarInactiveTintColor: theme.muted,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarStyle: {
          backgroundColor: theme.surfaceSecondary,
          borderTopColor: theme.divider,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
        },
        sceneStyle: { backgroundColor: theme.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => renderIcon("home", color, size),
          tabBarButtonTestID: "tab-home",
        }}
      />
      <Tabs.Screen
        name="sale"
        options={{
          title: "New Sale",
          tabBarIcon: ({ color, size }) => (
            <View>{renderIcon("sale", color, size)}</View>
          ),
          tabBarButtonTestID: "tab-sale",
        }}
      />
      <Tabs.Screen
        name="pending"
        options={{
          title: "Pending",
          tabBarIcon: ({ color, size }) => renderIcon("pending", color, size),
          tabBarButtonTestID: "tab-pending",
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => renderIcon("orders", color, size),
          tabBarButtonTestID: "tab-orders",
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => renderIcon("more", color, size),
          tabBarButtonTestID: "tab-more",
        }}
      />
    </Tabs>
  );
}
