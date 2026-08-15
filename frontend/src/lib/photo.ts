// Prompt the user to pick a bill photo (camera or gallery) and return a base64 data URL.
// - Handles permission requests contextually.
// - Falls back to the gallery when the camera is unavailable (e.g. web preview).
// - Compresses down to a reasonable size so AsyncStorage stays snappy.

import * as ImagePicker from "expo-image-picker";
import { Linking, Platform } from "react-native";

import { showToast } from "@/src/components/Toast";

type Source = "camera" | "gallery";

const requestPermission = async (source: Source): Promise<boolean> => {
  if (source === "camera") {
    const existing = await ImagePicker.getCameraPermissionsAsync();
    if (existing.granted) return true;
    if (existing.canAskAgain) {
      const res = await ImagePicker.requestCameraPermissionsAsync();
      if (res.granted) return true;
    }
    showToast("Camera permission denied — open Settings to allow", "error");
    Linking.openSettings().catch(() => {});
    return false;
  }
  const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (existing.granted) return true;
  if (existing.canAskAgain) {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.granted) return true;
  }
  showToast("Photos permission denied — open Settings to allow", "error");
  Linking.openSettings().catch(() => {});
  return false;
};

export const pickBillPhoto = async (source: Source): Promise<string | null> => {
  const ok = await requestPermission(source);
  if (!ok) return null;
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 0.6,
    base64: true,
    exif: false,
  };
  try {
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return null;
    const asset = result.assets?.[0];
    if (!asset) return null;
    // On web the picker may return a data URI in `uri` already.
    if (asset.base64) {
      const mime = asset.mimeType || "image/jpeg";
      return `data:${mime};base64,${asset.base64}`;
    }
    if (asset.uri?.startsWith("data:")) return asset.uri;
    return null;
  } catch (e) {
    if (Platform.OS === "web" && source === "camera") {
      showToast("Camera isn't available in the web preview", "info");
    }
    return null;
  }
};
