// Reusable form input with a floating label and semantic states.

import React from "react";
import { StyleProp, TextInput, TextStyle, View, ViewStyle, KeyboardTypeOptions, Text } from "react-native";

import { useApp } from "@/src/context/AppContext";
import { fontSize, radius, spacing } from "@/src/lib/theme";

export const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoFocus,
  editable = true,
  hint,
  error,
  right,
  inputStyle,
  containerStyle,
  testID,
  multiline,
  onSubmitEditing,
  returnKeyType,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "words" | "sentences";
  autoFocus?: boolean;
  editable?: boolean;
  hint?: string;
  error?: string;
  right?: React.ReactNode;
  inputStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
  multiline?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: "done" | "next" | "go";
}) => {
  const { theme } = useApp();
  return (
    <View style={[{ marginBottom: spacing.lg }, containerStyle]}>
      <Text
        style={{
          color: theme.muted,
          fontSize: fontSize.sm,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: spacing.xs,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: error ? theme.error : theme.border,
          backgroundColor: editable ? theme.surfaceSecondary : theme.surfaceTertiary,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          minHeight: 52,
        }}
      >
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.muted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoFocus={autoFocus}
          editable={editable}
          multiline={multiline}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          style={[
            {
              flex: 1,
              color: theme.onSurface,
              fontSize: fontSize.lg,
              paddingVertical: spacing.md,
            },
            multiline ? { minHeight: 84, textAlignVertical: "top" } : null,
            inputStyle,
          ]}
        />
        {right}
      </View>
      {error ? (
        <Text style={{ color: theme.error, fontSize: fontSize.sm, marginTop: spacing.xs }}>{error}</Text>
      ) : hint ? (
        <Text style={{ color: theme.muted, fontSize: fontSize.sm, marginTop: spacing.xs }}>{hint}</Text>
      ) : null}
    </View>
  );
};
