# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TheekKart admin dashboard — Next.js (App Router) app for managing the TheekKart grocery/delivery service: orders, products, categories, customers, app users, "Ask TheekKart" requests, banners/offers, notifications, reports. Shares the same Firebase project (Firestore/Storage/Auth) as the customer-facing Flutter app in `../THEEKART_FLUTTER`; Firestore collections and status enums must stay in sync between the two.

## Commands

```bash
npm install       # install dependencies
npm run dev       # start dev server (Next.js, Turbopack off by default)
npm run build     # production build
npm run start     # run production build
npm run lint      # eslint (eslint-config-next)
```

There is no test suite configured.

## Architecture

- **Auth is frontend-only, not Firebase Auth**: [lib/auth.js](lib/auth.js) checks a hardcoded username/password pair from `NEXT_PUBLIC_ADMIN_USERS` / `NEXT_PUBLIC_ADMIN_PASSWORD` env vars and sets a `sessionStorage` flag — there is no server-side session or token. [components/AdminGuard.jsx](components/AdminGuard.jsx) wraps the entire `(admin)` route group and client-side redirects to `/login` if that flag isn't set. This is explicitly marked in the source as not production-secure; don't assume any admin route is actually protected against a direct API/Firestore access.
- **Routing**: App Router with a `(admin)` route group ([app/(admin)/layout.js](app/(admin)/layout.js)) containing all authenticated pages (dashboard, orders, products, categories, customers, users, requests, banners, notifications, reports) sharing a `Sidebar` + `Header` shell. Page titles are keyed by base route in a `PAGE_TITLES` map in that layout — add new routes there too. `/login` is outside the group (no sidebar/guard).
- **Data layer**: [lib/firestore.js](lib/firestore.js) — all Firestore reads/writes go through here (no per-page ad hoc queries). Defines `COLLECTIONS`, `ORDER_STATUS`, `STATUS_LABELS`, `STATUS_COLORS` as the single source of truth for order status values/labels/colors — the Flutter app's order status strings must match `ORDER_STATUS` exactly. Note the deliberate pattern in `getOrders`: when filtering by status it avoids a Firestore composite index by querying without `orderBy` and sorting client-side instead — follow that pattern for other filtered+sorted queries rather than adding a composite index.
- **Firebase client init**: [lib/firebase.js](lib/firebase.js), config from `NEXT_PUBLIC_FIREBASE_*` env vars, guards against re-initializing (`getApps().length ? ... : initializeApp(...)`) for Next.js hot reload/SSR.
- **Storage rules**: see [FIREBASE_STORAGE_RULES.txt](FIREBASE_STORAGE_RULES.txt) — paste-able rules for the Firebase console (not deployed via CLI from this repo). `products/` and `banners/` images are publicly readable; `requests/` images (customer uploads) require auth to read. Any new upload path added in code needs a matching rule added here manually.
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/postcss`), utility classes directly in JSX, no component library beyond `lucide-react` icons.
- **Exports**: [lib/download.js](lib/download.js) has shared helpers for CSV/Excel (`xlsx`) and PDF (`jspdf` + `jspdf-autotable`) export, used by Reports and other list pages — reuse these instead of adding new export logic per page.
- **Path alias**: `@/*` maps to the repo root (see `jsconfig.json`), e.g. `@/lib/firebase`, `@/components/Sidebar`.
