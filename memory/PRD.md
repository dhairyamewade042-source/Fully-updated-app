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

## Backlog / Next
- Continue feature work as requested by user.
