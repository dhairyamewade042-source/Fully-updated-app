// Domain types for GarlicLedger Pro
// All data is persisted locally via AsyncStorage (offline-first).

export type OrderStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  createdAt: string; // ISO
}

// A Sale/Bill (they are the same entity).
// `initialReceived` is what the customer paid on the sale-creation day.
// `received` is the running total = initialReceived + sum(payment allocations).
// `pending = total - received`.
export interface Sale {
  id: string;
  customerId: string;
  customerName: string; // denormalised for quick display
  date: string; // ISO
  quantityKg: number;
  pricePerKg: number;
  total: number;
  initialReceived: number;
  received: number;
  createdAt: string; // ISO
}

// A payment received later (not tied to a specific sale up front).
// `appliedTo` records the FIFO allocation for the ledger.
export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  date: string; // ISO
  appliedTo: { saleId: string; amount: number }[];
  createdAt: string; // ISO
}

export interface Order {
  id: string;
  customerId?: string; // optional link; falls back to name for casual orders
  customerName: string;
  phone?: string;
  orderDate: string; // ISO
  deliveryDate: string; // ISO date (yyyy-mm-dd)
  deliveryTime?: string; // free-form "10:30 AM"
  quantityKg: number;
  expectedPricePerKg: number;
  estimatedTotal: number;
  address?: string;
  notes?: string;
  status: OrderStatus;
  createdAt: string; // ISO
}

// A bill received from a trader/supplier for raw garlic bought.
// `photoBase64` is a JPEG data URL (or plain base64) so it survives backup/restore.
export interface TraderBill {
  id: string;
  traderName: string;
  phone?: string;
  date: string; // ISO date of purchase
  amount: number;
  quantityKg?: number;
  pricePerKg?: number;
  notes?: string;
  photoBase64?: string; // "data:image/jpeg;base64,..."
  paid: boolean;
  paidDate?: string;
  createdAt: string;
}

export interface Settings {
  businessName: string;
  currency: string; // symbol
  darkMode: boolean;
  ownerName?: string;
}

export interface AppData {
  customers: Customer[];
  sales: Sale[];
  payments: Payment[];
  orders: Order[];
  traderBills: TraderBill[];
  settings: Settings;
  version: number;
}

export const DEFAULT_SETTINGS: Settings = {
  businessName: "My Garlic Business",
  currency: "₹",
  darkMode: false,
};

export const EMPTY_APP_DATA: AppData = {
  customers: [],
  sales: [],
  payments: [],
  orders: [],
  traderBills: [],
  settings: DEFAULT_SETTINGS,
  version: 1,
};
