// "More" tab — access to Customers, Reports, Backup, Settings.

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fontSize, radius, spacing } from "@/src/lib/theme";

const Row = ({
  icon,
  label,
  desc,
  onPress,
  testID,
}: {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  onPress: () => void;
  testID: string;
}) => {
  const { theme } = useApp();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: theme.brandTertiary,
            },
          ]}
        >
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "700" }}>{label}</Text>
          {desc ? (
            <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: 2 }}>{desc}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={22} color={theme.muted} />
      </Card>
    </Pressable>
  );
};

export default function MoreScreen() {
  const router = useRouter();
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader title="More" subtitle="Manage everything about your business" />
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 40 + insets.bottom,
        }}
      >
        <Row
          testID="more-customers"
          icon={<Ionicons name="people" size={22} color={theme.brandPrimary} />}
          label="Customers"
          desc="Search, view ledger, edit or delete"
          onPress={() => router.push("/customer")}
        />
        <Row
          testID="more-history"
          icon={<MaterialCommunityIcons name="history" size={22} color={theme.brandPrimary} />}
          label="Sales History"
          desc="Browse and edit past days' data"
          onPress={() => router.push("/history")}
        />
        <Row
          testID="more-purchase"
          icon={<MaterialCommunityIcons name="file-image-outline" size={22} color={theme.brandPrimary} />}
          label="Purchase Bills"
          desc="Store trader bills with photos, mark paid/unpaid"
          onPress={() => router.push("/purchase")}
        />
        <Row
          testID="more-reports"
          icon={<MaterialCommunityIcons name="chart-line" size={22} color={theme.brandPrimary} />}
          label="Reports"
          desc="Daily, weekly, monthly, yearly summaries"
          onPress={() => router.push("/reports")}
        />
        <Row
          testID="more-backup"
          icon={<Ionicons name="cloud-download-outline" size={22} color={theme.brandPrimary} />}
          label="Backup"
          desc="Export or import JSON — never lose data"
          onPress={() => router.push("/backup")}
        />
        <Row
          testID="more-settings"
          icon={<Ionicons name="settings-outline" size={22} color={theme.brandPrimary} />}
          label="Settings"
          desc="Business name, currency, dark mode"
          onPress={() => router.push("/settings")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    height: 44,
    width: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
});
