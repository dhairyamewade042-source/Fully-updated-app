// Formatting helpers (money, quantity, date) — kept small and pure.

import dayjs from "dayjs";

export const money = (value: number, currency = "₹") => {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? "-" : ""}${currency}${formatted}`;
};

export const kg = (value: number) => {
  const formatted = value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} kg`;
};

export const fmtDate = (iso: string) => dayjs(iso).format("DD MMM YYYY");
export const fmtDateShort = (iso: string) => dayjs(iso).format("DD MMM");
export const fmtDateTime = (iso: string) => dayjs(iso).format("DD MMM YYYY, hh:mm A");
export const toISODate = (d: Date) => dayjs(d).format("YYYY-MM-DD");
export const todayISO = () => dayjs().format("YYYY-MM-DD");
export const tomorrowISO = () => dayjs().add(1, "day").format("YYYY-MM-DD");

// Compare only the calendar day portion — normalises both sides to a
// local YYYY-MM-DD string so mixed "2026-08-02" and full-ISO inputs stay in sync
// regardless of the device timezone.
const ymd = (s: string) => dayjs(s).format("YYYY-MM-DD");
export const isSameDay = (a: string, b: string) => ymd(a) === ymd(b);
export const isToday = (iso: string) => ymd(iso) === dayjs().format("YYYY-MM-DD");
export const isTomorrow = (iso: string) =>
  ymd(iso) === dayjs().add(1, "day").format("YYYY-MM-DD");
export const isThisWeek = (iso: string) => {
  const target = ymd(iso);
  const start = dayjs().startOf("week").format("YYYY-MM-DD");
  const end = dayjs().endOf("week").format("YYYY-MM-DD");
  return target >= start && target <= end;
};
