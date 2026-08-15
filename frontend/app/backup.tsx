// Backup — export (share JSON) and import (document picker).

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import dayjs from "dayjs";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { showToast } from "@/src/components/Toast";
import { Body, Button, Card, Label } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { fontSize, radius, spacing } from "@/src/lib/theme";

export default function BackupScreen() {
  const { theme, data, exportAll, importAll, wipeAll } = useApp();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<"export" | "import" | "wipe" | null>(null);
  const [wipeConfirm, setWipeConfirm] = useState(false);

  const doExport = async () => {
    setBusy("export");
    try {
      const blob = exportAll();
      const json = JSON.stringify(blob, null, 2);
      const filename = `garlicledger-backup-${dayjs().format("YYYY-MM-DD-HHmm")}.json`;
      const file = new File(Paths.cache, filename);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/json",
          UTI: "public.json",
          dialogTitle: "Save backup",
        });
        showToast("Backup ready to share");
      } else {
        showToast(`Backup saved to ${file.uri}`, "info");
      }
    } catch (e: any) {
      showToast(e?.message || "Export failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setBusy("import");
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "*/*"],
        copyToCacheDirectory: true,
      });
      if (res.canceled) {
        setBusy(null);
        return;
      }
      const asset = res.assets?.[0];
      if (!asset) {
        showToast("No file selected", "error");
        return;
      }
      const file = new File(asset.uri);
      const text = await file.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        showToast("File is not valid JSON", "error");
        return;
      }
      const out = await importAll(parsed);
      if (out.ok) {
        showToast("Backup restored successfully");
      } else {
        showToast(out.error || "Import failed", "error");
      }
    } catch (e: any) {
      showToast(e?.message || "Import failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const doWipe = async () => {
    setBusy("wipe");
    try {
      await wipeAll();
      showToast("All data cleared", "info");
      setWipeConfirm(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScreenHeader title="Backup" subtitle="Keep your business data safe" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 + insets.bottom }}>
        <Card>
          <Label>Snapshot</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm }}>
            <View style={{ minWidth: 100 }}>
              <Text style={{ color: theme.muted, fontSize: fontSize.xs, fontWeight: "700" }}>
                CUSTOMERS
              </Text>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800" }}>
                {data.customers.length}
              </Text>
            </View>
            <View style={{ minWidth: 100 }}>
              <Text style={{ color: theme.muted, fontSize: fontSize.xs, fontWeight: "700" }}>SALES</Text>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800" }}>
                {data.sales.length}
              </Text>
            </View>
            <View style={{ minWidth: 100 }}>
              <Text style={{ color: theme.muted, fontSize: fontSize.xs, fontWeight: "700" }}>PAYMENTS</Text>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800" }}>
                {data.payments.length}
              </Text>
            </View>
            <View style={{ minWidth: 100 }}>
              <Text style={{ color: theme.muted, fontSize: fontSize.xs, fontWeight: "700" }}>ORDERS</Text>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800" }}>
                {data.orders.length}
              </Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={[styles.iconBox, { backgroundColor: theme.brandTertiary }]}>
              <Ionicons name="cloud-upload-outline" size={22} color={theme.brandPrimary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "700" }}>
                Export Backup
              </Text>
              <Body muted style={{ marginTop: spacing.xs }}>
                Save a JSON snapshot to Drive, email, or your phone storage.
              </Body>
            </View>
          </View>
          <Button
            label={busy === "export" ? "Preparing..." : "Export as JSON"}
            onPress={doExport}
            loading={busy === "export"}
            fullWidth
            style={{ marginTop: spacing.md }}
            testID="backup-export"
          />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={[styles.iconBox, { backgroundColor: theme.brandTertiary }]}>
              <Ionicons name="cloud-download-outline" size={22} color={theme.brandPrimary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "700" }}>
                Restore from Backup
              </Text>
              <Body muted style={{ marginTop: spacing.xs }}>
                Picks a JSON file you exported before. Current data will be replaced.
              </Body>
            </View>
          </View>
          <Button
            label={busy === "import" ? "Restoring..." : "Import JSON"}
            variant="secondary"
            onPress={doImport}
            loading={busy === "import"}
            fullWidth
            style={{ marginTop: spacing.md }}
            testID="backup-import"
          />
        </Card>

        <Card style={{ marginTop: spacing.md, borderColor: "#F5C6CB" }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={[styles.iconBox, { backgroundColor: "#FDECEA" }]}>
              <MaterialCommunityIcons name="delete-outline" size={22} color={theme.error} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ color: theme.onSurface, fontSize: fontSize.lg, fontWeight: "700" }}>
                Wipe All Data
              </Text>
              <Body muted style={{ marginTop: spacing.xs }}>
                Deletes every customer, sale, payment and order on this device.
              </Body>
            </View>
          </View>
          <Button
            label="Wipe Everything"
            variant="danger"
            onPress={() => setWipeConfirm(true)}
            fullWidth
            style={{ marginTop: spacing.md }}
            testID="backup-wipe"
          />
        </Card>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={wipeConfirm}
        onRequestClose={() => setWipeConfirm(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setWipeConfirm(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surfaceSecondary }]}>
            <Text style={{ color: theme.onSurface, fontSize: fontSize.xl, fontWeight: "800" }}>
              Wipe everything?
            </Text>
            <Text style={{ color: theme.muted, marginTop: spacing.sm }}>
              Export a backup first if you want to keep a copy.
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <Button label="Cancel" variant="ghost" onPress={() => setWipeConfirm(false)} style={{ flex: 1 }} />
              <Button
                label={busy === "wipe" ? "Wiping..." : "Wipe"}
                variant="danger"
                onPress={doWipe}
                loading={busy === "wipe"}
                style={{ flex: 1 }}
                testID="wipe-confirm"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
