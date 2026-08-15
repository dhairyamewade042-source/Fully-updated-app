// Export an HTML string as a PDF.
// - Web: renders the HTML in an ISOLATED document (new tab, or hidden iframe
//   fallback) and triggers the browser's Print / "Save as PDF". This guarantees
//   ONLY the statement prints — not the surrounding app page. (expo-print's web
//   printAsync was printing the whole page inside the mobile browser.)
// - Native: renders to a PDF file then opens the share sheet.

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { showToast } from "@/src/components/Toast";

// Inject a self-contained auto-print script just before </body> so the isolated
// document prints itself once its content (incl. inline SVG/images) has laid out.
const withAutoPrint = (html: string): string => {
  const script = `<script>
    (function(){
      function go(){ try { window.focus(); window.print(); } catch(e){} }
      if (document.readyState === "complete") { setTimeout(go, 350); }
      else { window.addEventListener("load", function(){ setTimeout(go, 350); }); }
    })();
  <\/script>`;
  return html.includes("</body>")
    ? html.replace("</body>", `${script}</body>`)
    : html + script;
};

const printHtmlWeb = (html: string): void => {
  const doc = withAutoPrint(html);

  // Preferred: a new tab. Isolated from the app DOM and reliable on mobile Chrome.
  // Allowed because this runs from a direct user tap (the Download button).
  const win = window.open("", "_blank");
  if (win) {
    win.document.open();
    win.document.write(doc);
    win.document.close();
    return;
  }

  // Fallback (pop-up blocked): print via a hidden iframe.
  const prev = document.getElementById("__stmt_print_frame__");
  if (prev) prev.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__stmt_print_frame__";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const idoc = iframe.contentWindow?.document || (iframe as any).contentDocument;
  idoc.open();
  idoc.write(doc);
  idoc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    }
    setTimeout(() => iframe.remove(), 3000);
  }, 500);
};

export const exportHtmlAsPdf = async (html: string): Promise<void> => {
  try {
    if (Platform.OS === "web") {
      printHtmlWeb(html);
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
