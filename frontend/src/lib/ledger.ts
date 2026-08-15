// Advance-aware customer ledger engine (pure, single source of truth).
//
// EVERY rupee a customer hands over — whether entered as a bill's `initialReceived`
// or as a separate `payment` — is applied to that customer's bills OLDEST-FIRST (FIFO).
// So a payment/received amount always clears the oldest outstanding bill before newer
// ones, regardless of which bill it was typed against.
//
// Any money that no open bill can absorb becomes the customer's ADVANCE BALANCE
// (a running credit). When a new bill is created, existing advance is auto-applied to
// the open bills oldest-first.
//
// Rules (match product spec):
//  - Bill ₹120, paid ₹150 -> bill Fully Paid, ₹30 saved as advance.
//  - ₹50 advance + new ₹120 bill -> ₹50 used, ₹70 remaining.
//  - Advance ₹200 + ₹120 bill -> ₹120 used, ₹80 advance kept.
//  - Three ₹240 bills (10/13/15 Aug) with ₹650 received total -> 10 & 13 Aug PAID,
//    15 Aug (newest) keeps the ₹70 pending.
//
// The engine also rebuilds `payment.appliedTo` (kept for existing features) and an
// Advance History (amount added / used, date, related bill or payment).

import dayjs from "dayjs";

import { Payment, Sale } from "./types";

const EPS = 0.0001;
const round2 = (n: number) => Math.round(n * 100) / 100;
const ymd = (s: string) => dayjs(s).format("YYYY-MM-DD");

export interface AdvanceEntry {
  id: string;
  type: "added" | "used";
  amount: number;
  date: string; // ISO
  saleId?: string; // related bill (used entries, or the overpaid bill for added)
  paymentId?: string; // source payment (added-from-payment)
}

export interface CustomerLedger {
  received: Record<string, number>; // saleId -> received (always capped at its total)
  appliedTo: Record<string, { saleId: string; amount: number }[]>; // paymentId -> allocations
  advance: number; // remaining advance/credit balance
  history: AdvanceEntry[]; // chronological advance movements
}

interface OpenBill {
  saleId: string;
  total: number;
  received: number;
}

// Compute the full ledger for ONE customer's sales + payments.
export const computeCustomerLedger = (
  sales: Sale[],
  payments: Payment[],
): CustomerLedger => {
  type Ev =
    | { kind: "sale"; date: string; created: string; sale: Sale }
    | { kind: "payment"; date: string; created: string; payment: Payment };

  const events: Ev[] = [
    ...sales.map((s) => ({
      kind: "sale" as const,
      date: s.date,
      created: s.createdAt || s.date,
      sale: s,
    })),
    ...payments.map((p) => ({
      kind: "payment" as const,
      date: p.date,
      created: p.createdAt || p.date,
      payment: p,
    })),
  ].sort((a, b) => {
    const d = ymd(a.date).localeCompare(ymd(b.date));
    if (d !== 0) return d;
    return String(a.created).localeCompare(String(b.created));
  });

  const openBills: OpenBill[] = []; // insertion order == chronological == FIFO (oldest first)
  const received: Record<string, number> = {};
  const appliedTo: Record<string, { saleId: string; amount: number }[]> = {};
  const history: AdvanceEntry[] = [];
  let advance = 0;
  let hid = 0;
  const nextId = () => `adv_${hid++}`;

  // Allocate `amount` of fresh incoming money to open bills oldest-first.
  // Returns the leftover that no bill could absorb, plus the per-bill allocation.
  const allocate = (amount: number): { leftover: number; allocations: { saleId: string; amount: number }[] } => {
    let remaining = round2(Math.max(0, amount));
    const allocations: { saleId: string; amount: number }[] = [];
    for (const bill of openBills) {
      if (remaining <= EPS) break;
      const owed = round2(bill.total - bill.received);
      if (owed <= EPS) continue;
      const take = Math.min(owed, remaining);
      bill.received = round2(bill.received + take);
      received[bill.saleId] = bill.received;
      remaining = round2(remaining - take);
      allocations.push({ saleId: bill.saleId, amount: round2(take) });
    }
    return { leftover: round2(remaining), allocations };
  };

  // Consume the carried ADVANCE credit across open bills oldest-first (logs "used").
  const applyAdvance = (date: string) => {
    if (advance <= EPS) return;
    for (const bill of openBills) {
      if (advance <= EPS) break;
      const owed = round2(bill.total - bill.received);
      if (owed <= EPS) continue;
      const take = Math.min(owed, advance);
      bill.received = round2(bill.received + take);
      advance = round2(advance - take);
      received[bill.saleId] = bill.received;
      history.push({ id: nextId(), type: "used", amount: round2(take), date, saleId: bill.saleId });
    }
  };

  for (const ev of events) {
    if (ev.kind === "sale") {
      const s = ev.sale;
      const bill: OpenBill = { saleId: s.id, total: round2(s.total), received: 0 };
      openBills.push(bill);
      received[s.id] = 0;

      // 1) spend any pre-existing advance credit first, oldest bill first
      applyAdvance(s.date);

      // 2) the amount received on this bill is normal money -> FIFO oldest-first
      const own = Math.max(0, s.initialReceived ?? 0);
      const { leftover } = allocate(own);

      // 3) whatever remains becomes advance credit
      if (leftover > EPS) {
        advance = round2(advance + leftover);
        history.push({ id: nextId(), type: "added", amount: leftover, date: s.date, saleId: s.id });
      }
    } else {
      const p = ev.payment;
      const { leftover, allocations } = allocate(Math.max(0, p.amount));
      appliedTo[p.id] = allocations;
      if (leftover > EPS) {
        advance = round2(advance + leftover);
        history.push({ id: nextId(), type: "added", amount: leftover, date: p.date, paymentId: p.id });
      }
    }
  }

  return {
    received,
    appliedTo,
    advance: round2(Math.max(0, advance)),
    history,
  };
};
