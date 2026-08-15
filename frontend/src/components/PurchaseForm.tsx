// Shared form for creating or editing a trader purchase bill.

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateField } from "@/src/components/DateField";
import { Field } from "@/src/components/Field";
import { showToast } from "@/src/components/Toast";
import { Body, Button, Card, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { money } from "@/src/lib/format";
import { pickBillPhoto } from "@/src/lib/photo";
import { fontSize, radius, spacing } from "@/src/lib/theme";
import { TraderBill } from "@/src/lib/types";

export const PurchaseForm = ({
  initial,
  onSubmit,
  onDelete,
  submitLabel,
}: {
  initial?: Partial<TraderBill>;
  onSubmit: (v: Omit<TraderBill, "id" | "createdAt">) => Promise<void>;
  onDelete?: () => Promise<void>;
  submitLabel: string;
}) => {
  const { theme, data } = useApp();
  const insets = useSafeAreaInsets();
  const currency = data.settings.currency;

  const [traderName, setTraderName] = useState(initial?.traderName || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [date, setDate] = useState(
    initial?.date ? dayjs(initial.date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
  );
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [qty, setQty] = useState(initial?.quantityKg ? String(initial.quantityKg) : "");
  const [pricePerKg, setPricePerKg] = useState(
    initial?.pricePerKg ? String(initial.pricePerKg) : "",
  );
  const [notes, setNotes] = useState(initial?.notes || "");
  const [photo, setPhoto] = useState<string | undefined>(initial?.photoBase64);
  const [paid, setPaid] = useState<boolean>(initial?.paid ?? false);
  const [busy, setBusy] = useState<null | "save" | "delete" | "photo">(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Auto-compute amount when qty*price provided, unless the user has manually
  // edited the amount field.
  const [amountManuallyEdited, setAmountManuallyEdited] = useState(
    !!initial?.amount && (!initial?.quantityKg || !initial?.pricePerKg),
  );
  useEffect(() => {
    if (amountManuallyEdited) return;
    const q = parseFloat(qty);
    const p = parseFloat(pricePerKg);
    if (isNaN(q) || isNaN(p) || q <= 0 || p <= 0) return;
    setAmount(String(+(q * p).toFixed(2)));
  }, [qty, pricePerKg, amountManuallyEdited]);

  const amountNum = parseFloat(amount) || 0;
  const canSave = traderName.trim().length > 0 && amountNum > 0;

  const takePhoto = async (source: "camera" | "gallery") => {
    setBusy("photo");
    const uri = await pickBillPhoto(source);
    setBusy(null);
    if (uri) setPhoto(uri);
  };

  const save = async () => {
    if (!canSave || busy) return;
    setBusy("save");
    try {
      await onSubmit({
        traderName: traderName.trim(),
        phone: phone.trim() || undefined,
        date: dayjs(date).toISOString(),
        amount: amountNum,
        quantityKg: parseFloat(qty) || undefined,
        pricePerKg: parseFloat(pricePerKg) || undefined,
        notes: notes.trim() || undefined,
        photoBase64: photo,
        paid,
        paidDate: paid
          ? initial?.paidDate || new Date().toISOString()
          : undefined,
      });
    } catch (e: any) {
      showToast(e?.message || "Could not save", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={20}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo block */}
        <Label>Bill Photo</Label>
        <View style={{ marginTop: spacing.sm }}>
          {photo ? (
            <View>
              <Pressable
                testID="purchase-photo-view"
                onPress={() => setViewerOpen(true)}
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <Image
                  source={{ uri: photo }}
                  testID="purchase-photo"
                  style={{
                    width: "100%",
                    height: 220,
                    borderRadius: radius.lg,
                    backgroundColor: theme.brandTertiary,
                  }}
                />
                {/* Floating "View Full" button on the image */}
                <Pressable
                  testID="purchase-photo-view-btn"
                  onPress={() => setViewerOpen(true)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.viewFullBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Ionicons name="expand" size={16} color="#FFF" />
                  <Text style={styles.viewFullText}>View Full</Text>
                </Pressable>
              </Pressable>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <Button
                  label="Retake"
                  variant="secondary"
                  onPress={() => takePhoto("camera")}
                  style={{ flex: 1 }}
                  loading={busy === "photo"}
                  testID="photo-retake"
                />
                <Button
                  label="Remove"
                  variant="ghost"
                  onPress={() => setPhoto(undefined)}
                  style={{ flex: 1 }}
                  testID="photo-remove"
                />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                testID="photo-camera"
                onPress={() => takePhoto("camera")}
                style={({ pressed }) => [
                  styles.photoBtn,
                  {
                    backgroundColor: theme.brandPrimary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name="camera" size={22} color="#FFF" />
                <Text style={{ color: "#FFF", fontWeight: "700", marginTop: spacing.xs }}>
                  Take Photo
                </Text>
              </Pressable>
              <Pressable
                testID="photo-gallery"
                onPress={() => takePhoto("gallery")}
                style={({ pressed }) => [
                  styles.photoBtn,
                  {
                    backgroundColor: theme.brandTertiary,
                    borderWidth: 1,
                    borderColor: theme.brandSecondary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name="images" size={22} color={theme.onBrandTertiary} />
                <Text
                  style={{
                    color: theme.onBrandTertiary,
                    fontWeight: "700",
                    marginTop: spacing.xs,
                  }}
                >
                  From Gallery
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ height: spacing.lg }} />
        <Field
          label="Trader Name"
          value={traderName}
          onChangeText={setTraderName}
          autoCapitalize="words"
          testID="purchase-trader"
        />
        <Field
          label="Phone (Optional)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          testID="purchase-phone"
        />
        <DateField label="Bill Date" value={date} onChange={setDate} testID="purchase-date" />

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Quantity (kg) — Optional"
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              testID="purchase-quantity"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={`Price / kg (${currency}) — Optional`}
              value={pricePerKg}
              onChangeText={setPricePerKg}
              keyboardType="decimal-pad"
              testID="purchase-price"
            />
          </View>
        </View>

        <Field
          label={`Bill Amount (${currency})`}
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            setAmountManuallyEdited(true);
          }}
          keyboardType="decimal-pad"
          hint="Auto-fills when you enter quantity × price"
          testID="purchase-amount"
        />

        <Field
          label="Notes (Optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="e.g. grade, invoice #, quality"
          testID="purchase-notes"
        />

        {/* Paid toggle */}
        <Card
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: paid ? theme.brandTertiary : "#FDECEA",
            borderColor: paid ? theme.brandSecondary : "#F5C6CB",
          }}
          testID="purchase-paid-card"
        >
          <View
            style={{
              height: 44,
              width: 44,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: paid ? theme.brandPrimary : theme.error,
            }}
          >
            <MaterialCommunityIcons
              name={paid ? "check-decagram" : "cash-clock"}
              size={22}
              color="#FFF"
            />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ color: theme.onSurface, fontSize: fontSize.md, fontWeight: "800" }}>
              {paid ? "Marked as PAID" : "Marked as UNPAID"}
            </Text>
            <Body muted style={{ fontSize: fontSize.sm, marginTop: 2 }}>
              Tap the button to toggle
            </Body>
          </View>
          <Pressable
            testID="purchase-toggle-paid"
            onPress={() => setPaid((p) => !p)}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.pill,
              backgroundColor: paid ? theme.surfaceSecondary : theme.brandPrimary,
              borderWidth: 1,
              borderColor: paid ? theme.border : theme.brandPrimary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: paid ? theme.onSurface : "#FFF",
                fontWeight: "800",
                fontSize: fontSize.sm,
              }}
            >
              {paid ? "Mark Unpaid" : "Mark Paid"}
            </Text>
          </Pressable>
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
          gap: spacing.sm,
        }}
      >
        {onDelete ? (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              label="Delete"
              variant="danger"
              onPress={async () => {
                setBusy("delete");
                await onDelete();
                setBusy(null);
              }}
              loading={busy === "delete"}
              style={{ flex: 1 }}
              testID="purchase-delete"
            />
            <Button
              label={submitLabel}
              onPress={save}
              disabled={!canSave}
              loading={busy === "save"}
              style={{ flex: 2 }}
              testID="purchase-save"
            />
          </View>
        ) : (
          <Button
            label={submitLabel}
            onPress={save}
            disabled={!canSave}
            loading={busy === "save"}
            fullWidth
            testID="purchase-save"
          />
        )}
        {amountNum > 0 ? (
          <Body muted style={{ textAlign: "center", fontSize: fontSize.sm }}>
            Bill amount: {money(amountNum, currency)}
          </Body>
        ) : null}
      </View>

      {/* Full-screen bill viewer */}
      <Modal
        visible={viewerOpen && !!photo}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={styles.viewerBackdrop}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.viewerScroll}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            {photo ? (
              <Image
                source={{ uri: photo }}
                testID="purchase-photo-fullscreen"
                resizeMode="contain"
                style={styles.viewerImage}
              />
            ) : null}
          </ScrollView>
          <Pressable
            testID="purchase-photo-close"
            onPress={() => setViewerOpen(false)}
            hitSlop={12}
            style={({ pressed }) => [
              styles.viewerClose,
              { top: insets.top + spacing.md, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="close" size={26} color="#FFF" />
          </Pressable>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  photoBtn: {
    flex: 1,
    height: 108,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  viewFullBtn: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  viewFullText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
  },
  viewerScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
    minHeight: 300,
  },
  viewerClose: {
    position: "absolute",
    right: spacing.lg,
    height: 44,
    width: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
});
