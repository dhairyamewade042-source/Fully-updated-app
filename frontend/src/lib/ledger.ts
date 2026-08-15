// Advance-aware customer ledger engine (pure, single source of truth).
//
// Money the customer hands over (a bill's `initialReceived` and every `payment.amount`)
// is applied to that customer's bills oldest-first (FIFO). Any leftover money that no
// open bill can absorb becomes the customer's ADVANCE BALANCE (a running credit).
// When a new bill is created, available advance is auto-applied to it (oldest bill first).
//
// Rules (match product spec):
//  - Bill ₹120, paid ₹150 -> bill Fully Paid, ₹30 saved as advance.
//  - ₹50 advance + new ₹120 bill -> ₹50 used, ₹70 remaining.
//  - Advance ₹200 + ₹120 bill -> ₹120 used, ₹80 advance kept.
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

  const openBills: OpenBill[] = []; // insertion order == chronological == FIFO
  const received: Record<string, number> = {};
  const appliedTo: Record<string, { saleId: string; amount: number }[]> = {};
  const history: AdvanceEntry[] = [];
  let advance = 0;
  let hid = 0;
  const nextId = () => `adv_${hid++}`;

  // Apply available advance across open bills, oldest-first.
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
      history.push({
        id: nextId(),
        type: "used",
        amount: round2(take),
        date,
        saleId: bill.saleId,
      });
    }
  };

  for (const ev of events) {
    if (ev.kind === "sale") {
      const s = ev.sale;
      const bill: OpenBill = { saleId: s.id, total: round2(s.total), received: 0 };
      openBills.push(bill);
      received[s.id] = 0;

      // 1) the bill's own money pays itself first (preserves existing behaviour)
      const own = Math.max(0, s.initialReceived ?? 0);
      const pay = Math.min(own, bill.total);
      bill.received = round2(pay);
      received[s.id] = bill.received;

      // 2) overpayment on this bill becomes advance
      const over = round2(own - pay);
      if (over > EPS) {
        advance = round2(advance + over);
        history.push({ id: nextId(), type: "added", amount: over, date: s.date, saleId: s.id });
      }

      // 3) auto-apply any advance (pre-existing + fresh overpay) to open bills FIFO
      applyAdvance(s.date);
    } else {
      const p = ev.payment;
      let remaining = round2(Math.max(0, p.amount));
      const alloc: { saleId: string; amount: number }[] = [];
      for (const bill of openBills) {
        if (remaining <= EPS) break;
        const owed = round2(bill.total - bill.received);
        if (owed <= EPS) continue;
        const take = Math.min(owed, remaining);
        bill.received = round2(bill.received + take);
        received[bill.saleId] = bill.received;
        remaining = round2(remaining - take);
        alloc.push({ saleId: bill.saleId, amount: round2(take) });
      }
      appliedTo[p.id] = alloc;
      // leftover payment becomes advance
      if (remaining > EPS) {
        advance = round2(advance + remaining);
        history.push({
          id: nextId(),
          type: "added",
          amount: remaining,
          date: p.date,
          paymentId: p.id,
        });
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
