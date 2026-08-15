// Offline repository backed by AsyncStorage via the shared `storage` singleton.
// All mutations go through here so the AppContext can hydrate/re-persist as one blob.

import { storage } from "@/src/utils/storage";
import { AppData, EMPTY_APP_DATA, Sale } from "./types";

const KEY = "garlicledger.appdata.v1";

// Backfill sales that pre-date the `initialReceived` field.
// initialReceived = received - sum(payment allocations to this sale)
const backfillInitialReceived = (data: AppData): AppData => {
  const needsFix = data.sales.some((s) => (s as Sale).initialReceived === undefined);
  if (!needsFix) return data;
  const appliedBySale = new Map<string, number>();
  data.payments.forEach((p) => {
    p.appliedTo?.forEach((a) => {
      appliedBySale.set(a.saleId, (appliedBySale.get(a.saleId) || 0) + a.amount);
    });
  });
  return {
    ...data,
    sales: data.sales.map((s) => ({
      ...s,
      initialReceived:
        (s as Sale).initialReceived !== undefined
          ? (s as Sale).initialReceived
          : Math.max(0, s.received - (appliedBySale.get(s.id) || 0)),
    })),
  };
};

export const loadAppData = async (): Promise<AppData> => {
  const raw = await storage.getItem<any>(KEY, null as any);
  if (!raw || typeof raw !== "object") return EMPTY_APP_DATA;
  // Merge to tolerate older schemas
  const merged: AppData = {
    ...EMPTY_APP_DATA,
    ...raw,
    traderBills: Array.isArray(raw.traderBills) ? raw.traderBills : [],
    settings: { ...EMPTY_APP_DATA.settings, ...(raw.settings || {}) },
  };
  return backfillInitialReceived(merged);
};

export const saveAppData = async (data: AppData): Promise<boolean> => {
  return storage.setItem(KEY, data as any);
};

export const wipeAppData = async () => storage.removeItem(KEY);
