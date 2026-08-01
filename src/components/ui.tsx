// Reusable primitive components — kept intentionally small.
// Each accepts a `theme` prop or uses `useApp()` internally.

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useApp } from "@/src/context/AppContext";
import { fontSize, radius, spacing } from "@/src/lib/theme";

// ---------- Card ----------
export const Card = ({
  children,
  style,
  onPress,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}) => {
  const { theme } = useApp();
  const content = (
    <View
      style={[
        {
          backgroundColor: theme.surfaceSecondary,
          borderRadius: radius.lg,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
      >
        {content}
      </Pressable>
    );
  }
  return <View testID={testID}>{content}</View>;
};

// ---------- Button ----------
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const Button = ({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  fullWidth,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) => {
  const { theme } = useApp();
  const bg =
    variant === "primary"
      ? theme.brandPrimary
      : variant === "secondary"
        ? theme.brandTertiary
        : variant === "danger"
          ? theme.error
          : "transparent";
  const fg =
    variant === "primary"
      ? theme.onBrandPrimary
      : variant === "secondary"
        ? theme.onBrandTertiary
        : variant === "danger"
          ? theme.onError
          : theme.brandPrimary;
  const borderColor = variant === "ghost" ? theme.border : "transparent";
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: 1,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.xl,
          height: 52,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.85 : disabled ? 0.5 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text style={{ color: fg, fontSize: fontSize.lg, fontWeight: "700" }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
};

// ---------- Text primitives ----------
export const H1 = ({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) => {
  const { theme } = useApp();
  return (
    <Text
      testID={testID}
      style={[
        { color: theme.onSurface, fontSize: fontSize.xxl, fontWeight: "800", letterSpacing: -0.5 },
        style,
      ]}
    >
      {children}
    </Text>
  );
};
export const H2 = ({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) => {
  const { theme } = useApp();
  return (
    <Text
      testID={testID}
      style={[{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "700" }, style]}
    >
      {children}
    </Text>
  );
};
export const Body = ({
  children,
  muted,
  style,
  testID,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) => {
  const { theme } = useApp();
  return (
    <Text
      testID={testID}
      style={[{ color: muted ? theme.muted : theme.onSurface, fontSize: fontSize.base }, style]}
    >
      {children}
    </Text>
  );
};
export const Label = ({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) => {
  const { theme } = useApp();
  return (
    <Text
      testID={testID}
      style={[
        {
          color: theme.muted,
          fontSize: fontSize.sm,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

// ---------- Badge ----------
export const Badge = ({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "error" | "info";
}) => {
  const { theme } = useApp();
  const palette: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: theme.border, fg: theme.onSurface },
    success: { bg: theme.brandTertiary, fg: theme.onBrandTertiary },
    warning: { bg: "#FFF3CD", fg: "#8A5A00" },
    error: { bg: "#FDECEA", fg: theme.error },
    info: { bg: theme.surfaceTertiary, fg: theme.onSurfaceTertiary },
  };
  const p = palette[tone];
  return (
    <View
      style={{
        backgroundColor: p.bg,
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
        borderRadius: radius.pill,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: p.fg, fontSize: fontSize.sm, fontWeight: "700" }}>{label}</Text>
    </View>
  );
};

// ---------- EmptyState ----------
export const EmptyState = ({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) => {
  const { theme } = useApp();
  return (
    <View style={styles.emptyWrap}>
      <View
        style={{
          backgroundColor: theme.brandTertiary,
          height: 72,
          width: 72,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.lg,
        }}
      >
        {icon}
      </View>
      <H2 style={{ textAlign: "center", marginBottom: spacing.xs }}>{title}</H2>
      {subtitle ? (
        <Body muted style={{ textAlign: "center", maxWidth: 260 }}>
          {subtitle}
        </Body>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyWrap: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
});
