# GarlicLedger Pro — PRD / Project Memory

## Origin
Migrated/imported from GitHub repo `dhairyamewade042-source/garlic-biz-latest` (branch `master`)
into a fresh Emergent workspace on 2026-08-15. This is a CONTINUATION of an existing project,
not a new build.

## What it is
An offline-first mobile business ledger for a **garlic wholesale business**, built with
**Expo (React Native) + expo-router**, running on web via Metro/react-native-web.

Brand: strict green + white palette. Currency default ₹ (INR).

## Tech stack
- Expo SDK 54, React 19, React Native 0.81, expo-router 6 (file-based routing)
- State: React Context (`src/context/AppContext.tsx`)
- Persistence: 100% local via AsyncStorage (`src/utils/storage`, `src/lib/db.ts`),
  key `garlicledger.appdata.v1`. NO backend, NO external API, NO env vars required.
- Icons: @expo/vector-icons (fonts from jsDelivr CDN only under Expo Go)

## Architecture notes
- Single app-data blob hydrated once, re-persisted on every mutation.
- FIFO payment allocation implemented in `rebuildCustomerLedger` (oldest unpaid bill cleared first).
- Domain: Customers, Sales/Bills, Payments, Orders, TraderBills (purchases), Settings.

## Routes (app/)
- `(tabs)/index` Dashboard, `(tabs)/sale` New Sale, `(tabs)/pending`, `(tabs)/orders`, `(tabs)/more`
- customer/[id], customer/index, order/[id], order/new, purchase/*, receive-payment/[customerId],
  history, reports, settings, backup

## Migration fixes applied (2026-08-15)
1. Repo cloned into `/app` root but Emergent supervisor expects the Expo app in `/app/frontend`.
   → Relocated all app files into `/app/frontend` (kept `.git` at `/app`).
2. `yarn start` (= `expo start`) bound Metro to 8081; Emergent preview needs port 3000.
   → Changed `start` script to `expo start --port 3000` in package.json.
3. `yarn install` ran clean. App bundles successfully (1341 modules), no runtime errors.

## Environment variables
NONE required. App is fully offline/local. (No `.env` needed for frontend or backend.)
Backend supervisor stays idle/FATAL because there is no backend — this is expected and harmless.

## Status
- Imported & running on port 3000. Frontend-only Expo web app.

## Feature log (post-migration)
- 2026-08-15: Full-screen **bill photo viewer** on Purchase Bill form ("View Full" button + tap image → zoomable modal). File: `src/components/PurchaseForm.tsx`.
- 2026-08-15: Dashboard **hero "Today's Sales" card is tappable** → opens **Day Report** screen (`app/day-report/[date].tsx`) for the selected date. Shows summary KPIs + full customer/bill list with Paid/Partial/Unpaid status + payments collected + purchases. **Export PDF statement** via `expo-print` (web = print dialog / Save-as-PDF; native = printToFileAsync + Sharing share sheet). Helper: `src/lib/pdf.ts`. `DateField` now `forwardRef` exposing `open()`; report screen has its own date picker to change day.
- Added dependency: `expo-print@~15.0.8`.

- 2026-08-15: **Advance Balance** in the customer payment system. New pure engine `src/lib/ledger.ts` (`computeCustomerLedger`) — FIFO oldest-first; a bill's own `initialReceived` pays itself first, any overpayment (from a sale OR a payment) becomes **advance credit** that auto-applies to future bills oldest-first. `AppContext` now uses this engine in `rebuildCustomerLedger` and exposes `customerAdvance(id)` + `customerAdvanceHistory(id)`; `addSale`/`updateSale` no longer clamp `initialReceived` to the bill total. UI: New Sale + Receive Payment allow overpay and show the advance saved; customer profile shows an **Advance Balance** card + **Advance History** (added/used, date, related bill); Day Report shows Advance Added/Used and an Advance Balances section in the PDF. Verified 100% (all spec examples + FIFO regression). Existing data/features unaffected (advance is fully derived, no schema migration).
- 2026-08-15: **FIFO fix** — money a customer pays now clears the OLDEST bill first, including amounts typed into New Sale's "Amount Received" (previously that stuck to its own bill, leaving an older bill wrongly pending). `src/lib/ledger.ts` now routes every incoming amount through a single oldest-first `allocate()`; pre-existing advance drains first. Verified: three ₹240 bills (10/13/15 Aug) + ₹650 received → 10 & 13 Aug PAID, ₹70 pending on 15 Aug (newest).

## Backlog / Next
- Continue feature work as requested by user.

## Feature update (2026-08-15) — Purchase Bills → trader-grouped
Reworked ONLY the Purchase Bills section (no changes to sales/customers/orders/bill create-edit system).
- New pure helpers: `src/lib/purchase.ts` (`billPayment` → paid/remaining/status derived from existing binary `paid` flag, honours optional `paidAmount`; `groupByTrader`, `purchaseSummary`, `billsForTrader`).
- `app/purchase/index.tsx` rewritten: top summary band (Total Bills · Pending · Outstanding, all derived), trader SEARCH (name/phone), and a list of TRADERS (grouped) instead of individual bills. Tap a trader → trader detail.
- New screen `app/purchase/trader/[name].tsx`: lists that trader's bills (Date, Bill Amount, Paid, Remaining, status Paid/Partially Paid/Unpaid). Tapping a bill opens the existing `/purchase/[id]` details/edit screen (with uploaded photo) — reuses existing bill system.
- Existing `app/purchase/[id].tsx` and `PurchaseForm` left untouched. Verified 100% via testing agent (iteration_6.json).

## Feature update (2026-08-15) — Customer Statement PDF redesigned (A4 khata)
Redesigned ONLY `buildLedgerHtml()` in `app/customer/[id].tsx` (export mechanism `src/lib/pdf.ts` unchanged).
- Professional A4, print-ready, dark-green/white/light-gray theme; inline SVG garlic logo letterhead: GARLIC HUB · "Garlic Supplier & Packaging" · 📞 +91 7509730965 · 📍 Bercha Road, Dusherra Maidan, Shajapur. No QR/GSTIN.
- Customer Details (Name, Phone, Statement Date, Statement Period) + Account Summary (Opening, Total Debit, Total Credit, Closing Dr./Cr.).
- ONE chronological khata ledger table: Date · Particulars · Quantity · Debit · Credit · Dr./Cr. · Balance. Each sale → Debit row (+ its initialReceived as a Credit row); each payment → Credit row. Running Balance = prev + Debit − Credit; advance shows Cr. Dark-green header (repeats per print page via thead), zebra rows, tabular ₹, auto totals row. Footer with generated timestamp + "Thank you for your business!". No app controls / no Balance-Due box. All values derived from real data (no hard-coding).
- Verified: visual A4 render (premium) + runtime/regression smoke via testing agent (iteration_7.json, 100%, 0 errors).

## Bug fix (2026-08-15) — Statement PDF was printing the app page (web)
- Symptom (user, mobile Chrome): "Download Statement (PDF)" printed the customer PROFILE SCREEN, not the redesigned GARLIC HUB statement — the custom HTML never appeared.
- Root cause: expo-print web `printAsync({html})` printed the surrounding app document instead of the provided HTML.
- Fix (`src/lib/pdf.ts`): on web, render the statement in an ISOLATED document — `window.open('','_blank')` + `document.write(html)` with an embedded auto-print `<script>`; hidden-iframe fallback (id `__stmt_print_frame__`) if pop-ups are blocked. Native path (printToFileAsync + Sharing) unchanged.
- Verified (iteration_8.json, 100%): isolated tab contains full GARLIC HUB ledger with correct derived totals (₹200/₹50/₹150 Dr); app stays functional, 0 console errors.
