// Custom sticky screen header — SafeArea aware, supports back button + right slot.

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/context/AppContext";
import { fontSize, spacing } from "@/src/lib/theme";

export const ScreenHeader = ({
  title,
  subtitle,
  showBack = false,
  right,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}) => {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + spacing.sm,
          backgroundColor: theme.surface,
          borderBottomColor: theme.divider,
        },
      ]}
    >
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            testID="header-back"
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: spacing.sm })}
          >
            <Ionicons name="chevron-back" size={26} color={theme.onSurface} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.onSurface, fontSize: fontSize.xxl, fontWeight: "800" }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: theme.muted, fontSize: fontSize.md, marginTop: 2 }}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
});
