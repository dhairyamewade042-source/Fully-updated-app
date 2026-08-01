// Lightweight toast — top-of-screen, auto-dismisses, queue of one.
// Exposed via a global function `showToast(message, type?)` and a <ToastHost /> mounted at root.

import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fontSize, radius, spacing } from "@/src/lib/theme";

type ToastType = "success" | "error" | "info";
type ToastMsg = { id: number; message: string; type: ToastType };

let pushToast: ((t: Omit<ToastMsg, "id">) => void) | null = null;

export const showToast = (message: string, type: ToastType = "success") => {
  pushToast?.({ message, type });
};

export const ToastHost = () => {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    pushToast = (t) => {
      const next: ToastMsg = { ...t, id: Date.now() };
      setToast(next);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
        setToast(null),
      );
    }, 2200);
    return () => clearTimeout(timer);
  }, [toast, opacity]);

  if (!toast) return null;
  const bg = toast.type === "error" ? "#D32F2F" : toast.type === "info" ? "#455A64" : "#2E7D32";
  return (
    <Animated.View
      pointerEvents="none"
      testID="toast"
      style={[
        styles.wrap,
        { top: insets.top + spacing.md, opacity },
      ]}
    >
      <View style={[styles.pill, { backgroundColor: bg }]}>
        <Text style={styles.text}>{toast.message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    maxWidth: "90%",
  },
  text: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "700",
  },
});
