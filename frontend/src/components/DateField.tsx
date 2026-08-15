// Reusable date-only picker in a modal (avoids extra deps).
// Wheels not needed — just three buttons: Today / Tomorrow / Custom (calendar picker).
// We use a simple 3-column grid to pick day/month/year.

import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import React, { forwardRef, useImperativeHandle, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/src/context/AppContext";
import { fmtDate } from "@/src/lib/format";
import { fontSize, radius, spacing } from "@/src/lib/theme";
import { Button } from "@/src/components/ui";

export type DateFieldHandle = { open: () => void };

export const DateField = forwardRef<
  DateFieldHandle,
  {
    label: string;
    value: string; // YYYY-MM-DD
    onChange: (v: string) => void;
    testID?: string;
    allowPast?: boolean;
  }
>(function DateField({ label, value, onChange, testID, allowPast = true }, ref) {
  const { theme } = useApp();
  const [open, setOpen] = useState(false);

  const current = dayjs(value);
  const today = dayjs();

  // Build days for the current month view.
  const [viewMonth, setViewMonth] = useState<dayjs.Dayjs>(current);

  useImperativeHandle(ref, () => ({
    open: () => {
      setViewMonth(dayjs(value));
      setOpen(true);
    },
  }), [value]);

  const startOfMonth = viewMonth.startOf("month");
  const daysInMonth = viewMonth.daysInMonth();
  const firstWeekday = startOfMonth.day(); // 0=Sun

  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label ? (
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
      ) : null}
      <Pressable
        testID={testID}
        onPress={() => {
          setViewMonth(dayjs(value));
          setOpen(true);
        }}
        style={({ pressed }) => ({
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surfaceSecondary,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          height: 52,
          flexDirection: "row",
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons name="calendar-outline" size={20} color={theme.brandPrimary} />
        <Text
          style={{
            flex: 1,
            marginLeft: spacing.sm,
            color: theme.onSurface,
            fontSize: fontSize.lg,
          }}
        >
          {value ? fmtDate(value) : "Choose a date"}
        </Text>
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.card, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
          >
            {/* Header — month nav */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
              <Pressable
                onPress={() => setViewMonth((m) => m.subtract(1, "month"))}
                hitSlop={10}
                style={{ padding: spacing.sm }}
              >
                <Ionicons name="chevron-back" size={22} color={theme.onSurface} />
              </Pressable>
              <Text
                style={{
                  flex: 1,
                  textAlign: "center",
                  color: theme.onSurface,
                  fontSize: fontSize.lg,
                  fontWeight: "800",
                }}
              >
                {viewMonth.format("MMMM YYYY")}
              </Text>
              <Pressable
                onPress={() => setViewMonth((m) => m.add(1, "month"))}
                hitSlop={10}
                style={{ padding: spacing.sm }}
              >
                <Ionicons name="chevron-forward" size={22} color={theme.onSurface} />
              </Pressable>
            </View>

            {/* Weekday header */}
            <View style={{ flexDirection: "row", marginBottom: spacing.xs }}>
              {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ color: theme.muted, fontWeight: "700", fontSize: fontSize.sm }}>
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            {/* Days grid */}
            <ScrollView style={{ maxHeight: 300 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {cells.map((d, i) => {
                  if (d === null) {
                    return <View key={i} style={{ width: "14.28%", height: 40 }} />;
                  }
                  const iso = viewMonth.date(d).format("YYYY-MM-DD");
                  const selected = iso === value;
                  const past = !allowPast && dayjs(iso).isBefore(today, "day");
                  return (
                    <Pressable
                      key={i}
                      disabled={past}
                      onPress={() => {
                        onChange(iso);
                        setOpen(false);
                      }}
                      style={({ pressed }) => ({
                        width: "14.28%",
                        height: 40,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: past ? 0.3 : pressed ? 0.6 : 1,
                      })}
                    >
                      <View
                        style={{
                          height: 34,
                          width: 34,
                          borderRadius: 17,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: selected ? theme.brandPrimary : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? theme.onBrandPrimary : theme.onSurface,
                            fontWeight: selected ? "800" : "500",
                          }}
                        >
                          {d}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              {allowPast ? (
                <Button
                  label="Yesterday"
                  variant="secondary"
                  onPress={() => {
                    onChange(today.subtract(1, "day").format("YYYY-MM-DD"));
                    setOpen(false);
                  }}
                  style={{ flex: 1 }}
                />
              ) : null}
              <Button
                label="Today"
                variant="secondary"
                onPress={() => {
                  onChange(today.format("YYYY-MM-DD"));
                  setOpen(false);
                }}
                style={{ flex: 1 }}
              />
              <Button
                label="Tomorrow"
                variant="secondary"
                onPress={() => {
                  onChange(today.add(1, "day").format("YYYY-MM-DD"));
                  setOpen(false);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
  },
});
