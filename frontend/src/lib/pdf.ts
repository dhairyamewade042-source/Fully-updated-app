// Export an HTML string as a PDF.
// - Web: opens the browser print dialog (user can "Save as PDF").
// - Native: renders to a PDF file then opens the share sheet.

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { showToast } from "@/src/components/Toast";

export const exportHtmlAsPdf = async (html: string): Promise<void> => {
  try {
    if (Platform.OS === "web") {
      await Print.printAsync({ html });
      return;
    }
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share statement",
        UTI: "com.adobe.pdf",
      });
    } else {
      showToast("PDF saved to: " + uri, "info");
    }
  } catch (e: any) {
    showToast(e?.message || "Could not export PDF", "error");
  }
};
