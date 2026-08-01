// Settings — business name, currency, dark mode.

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Field } from "@/src/components/Field";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { showToast } from "@/src/components/Toast";
import { Body, Button, Card, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fontSize, radius, spacing } from "@/src/lib/theme";

const CURRENCIES = ["₹", "$", "€", "£", "¥"];

export default function SettingsScreen() {
  const { theme, data, updateSettings } = useApp();
  const insets = useSafeAreaInsets();
  const [businessName, setBusinessName] = useState(data.settings.businessName);
  const [ownerName, setOwnerName] = useState(data.settings.ownerName || "");
  const [currency, setCurrency] = useState(data.settings.currency);
  const [dark, setDark] = useState(data.settings.darkMode);

  const save = async () => {
    await updateSettings({
      businessName: businessName.trim() || "My Business",
      ownerName: ownerName.trim() || undefined,
      currency,
      darkMode: dark,
    });
    showToast("Settings saved");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader title="Settings" subtitle="Tune the app to your business" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 + insets.bottom }}>
        <Card>
          <Label>Business Profile</Label>
          <View style={{ height: spacing.md }} />
          <Field
            label="Business Name"
            value={businessName}
            onChangeText={setBusinessName}
            autoCapitalize="words"
            testID="settings-business-name"
          />
          <Field
            label="Owner Name (Optional)"
            value={ownerName}
            onChangeText={setOwnerName}
            autoCapitalize="words"
            testID="settings-owner-name"
          />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Label>Currency</Label>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" }}>
            {CURRENCIES.map((c) => {
              const active = c === currency;
              return (
                <Pressable
                  key={c}
                  testID={`settings-currency-${c}`}
                  onPress={() => setCurrency(c)}
                  style={({ pressed }) => ({
                    width: 52,
                    height: 44,
                    borderRadius: radius.md,
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
                      fontSize: fontSize.xl,
                      fontWeight: "800",
                    }}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "center" }}>
          <View style={[styles.iconBox, { backgroundColor: theme.brandTertiary }]}>
            <Ionicons name={dark ? "moon" : "sunny-outline"} size={22} color={theme.brandPrimary} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "700" }}>
              Dark Mode
            </Text>
            <Body muted style={{ marginTop: 2 }}>
              Save your eyes at night
            </Body>
          </View>
          <Switch
            testID="settings-dark-mode"
            value={dark}
            onValueChange={setDark}
            thumbColor={dark ? theme.brandPrimary : "#fff"}
            trackColor={{ true: theme.brandSecondary, false: theme.border }}
          />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Label>Backup Reminder</Label>
          <Body muted style={{ marginTop: spacing.xs }}>
            Head to the Backup screen every week to export a fresh JSON snapshot.
          </Body>
        </Card>
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
        <Button label="Save Settings" onPress={save} fullWidth testID="settings-save" />
      </View>
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
  },
});
