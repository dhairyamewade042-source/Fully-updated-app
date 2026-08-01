// Open WhatsApp with a pre-filled message.
// Uses the standard wa.me link so it works whether or not the app is installed
// (WhatsApp intercepts wa.me on device; browser preview falls back to the site).

import { Linking } from "react-native";

const CACHED_DEFAULT_CC = "91"; // India default; users can prefix their own CC.

export const cleanPhone = (raw?: string): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return CACHED_DEFAULT_CC + digits;
  return digits.replace(/^0+/, "");
};

export const openWhatsApp = async (rawPhone: string | undefined, message: string) => {
  const phone = cleanPhone(rawPhone);
  const encoded = encodeURIComponent(message);
  const url = phone
    ? `https://wa.me/${phone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
};

export const paymentReminder = ({
  businessName,
  customerName,
  pendingAmount,
  currency,
  oldestPendingDate,
}: {
  businessName: string;
  customerName: string;
  pendingAmount: string;
  currency: string;
  oldestPendingDate?: string;
}) => {
  const lines = [
    `Namaste ${customerName} 🙏`,
    ``,
    `This is a gentle reminder from *${businessName}*.`,
    `You have an outstanding balance of *${currency}${pendingAmount}* for garlic supplied.`,
  ];
  if (oldestPendingDate) {
    lines.push(`Oldest unpaid bill: ${oldestPendingDate}`);
  }
  lines.push(``, `Kindly clear the payment at the earliest.`, ``, `Thank you!`);
  return lines.join("\n");
};
