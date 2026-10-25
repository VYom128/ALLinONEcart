# ALLinONEcart – Project Specification

> **All-in-one cart and life-goals app** · Express + MongoDB + Expo (React Native) · TypeScript
> Version 1.0 · Living document
>
> This file is the single source of truth for *what* ALLinONEcart does. `CLAUDE.md` summarises the rules; this file holds the detail. If the code and this spec disagree, flag it and update one of them — never diverge silently. Build only what the current phase asks for (see §19). "ALLinONEcart" is the working name until the brand is decided (§20).

---

## Table of contents

1. [Overview](#1-overview)
2. [Users, roles and permissions](#2-users-roles-and-permissions)
3. [System architecture](#3-system-architecture)
4. [Core workflows](#4-core-workflows)
5. [State machines](#5-state-machines)
6. [Data model (MongoDB schemas)](#6-data-model-mongodb-schemas)
7. [REST API specification](#7-rest-api-specification)
8. [Business rules](#8-business-rules)
9. [Product extraction and store adapters](#9-product-extraction-and-store-adapters)
10. [Exact-match price comparison](#10-exact-match-price-comparison)
11. [Security, privacy and audit](#11-security-privacy-and-audit)
12. [Notifications](#12-notifications)
13. [Mobile app specification](#13-mobile-app-specification)
14. [Dashboard and metrics](#14-dashboard-and-metrics)
15. [Testing strategy and seed data](#15-testing-strategy-and-seed-data)
16. [Error code catalogue](#16-error-code-catalogue)
17. [Non-functional requirements](#17-non-functional-requirements)
18. [Environments and deployment](#18-environments-and-deployment)
19. [Build phases mapped to this spec](#19-build-phases-mapped-to-this-spec)
20. [Open decisions](#20-open-decisions)

---

## 1. Overview

### 1.1 Purpose
ALLinONEcart has **two separate sections that never mix** (D6):

- **Cart** – everything the user has put in the carts and wishlists of shopping apps: their Myntra cart, Amazon cart, Zara cart, H&M cart, Bear House cart, Flipkart cart… Items are saved by sharing or pasting a product link and are grouped by store, with live prices, a Buy button that opens the store, and (V2) the exact same product cheaper elsewhere.
- **Goals** – the big things the user is working toward that no shopping cart holds: a house, a Porsche, a BMW, a trip. Each goal has a target price, savings progress, an optional target date and its cost in hours of work. Seeing them motivates the user to work and earn more.

The two sections have separate data, screens, totals and rules. Nothing moves from one to the other, and their totals are never added together.

### 1.2 Goals
- Capture a cart item in under 10 seconds: share from a store app or paste a link.
- One Cart that shows every store's cart in one place, grouped by store and category, with totals.
- A separate Goals section that turns big targets into motivation: savings progress, hours of work, target dates, vision board, achieved wall.
- Show the same cart product's price on other stores (exact match only, V2).
- Keep income and goals private.

### 1.3 Out of scope (v1)
- Moving items between Cart and Goals (separate by design, D6).
- Checkout inside the app. Purchases always happen on the store's own app or site.
- Reading a store's cart automatically (no store offers a cart API).
- Similar / look-alike product suggestions (parked, §20).
- Email parsing of order or cart emails.
- Bank or investment account linking.
- Multiple currencies (INR only in v1; the model stores a currency code so it can be added).

### 1.4 Glossary
| Term | Meaning |
|---|---|
| Section | Either **Cart** or **Goals**. Separate collections, modules, endpoints, screens, totals and rules. |
| Cart item | A product saved from a store link into the Cart. Points to a Product and has a live price. |
| Goal | A big target created by hand in Goals (house, car, trip). Has a target price, an optional photo and an optional reference link. |
| Product | One unique product page on one store, shared by every user who saves it. Holds the live price. Cart only. |
| Store | A shopping platform (Zara, Myntra, Amazon, Apple, Croma…). |
| Store cart | The user's cart items from one store ("my Zara cart") – a group in the Cart section. |
| Adapter | The code that reads one store's product pages (and, in V2, searches it). |
| Category | Each section has its own built-in categories (§6.7) plus the user's own. |
| Horizon | Goals only: `this_year`, `big_goal`, `life_goal`. |
| Priority | `must_have`, `want`, `dream` (both sections). |
| Cart status | `in_cart`, `waiting` (V2 cooling-off), `bought`, `removed` (§5.1). |
| Goal status | `active`, `saving`, `achieved`, `dropped` (§5.1). |
| Contribution | Money the user sets aside toward one goal. Goals only. |
| Income entry | The user's income for one month. Used by Goals. |
| Hours of work | Remaining goal cost ÷ the user's hourly income (§8.3). Goals only. |
| Exact match | The identical product and variant on another store (§10.1). Cart only. |
| Match group | The set of Products on different stores that are the same exact product. |
| Offer | One store's price, stock and delivery for an exact match. |
| Bought history | Cart items the user marked as bought. |
| Vision board | Full-screen photo grid of active goals, prices hidden. |
| Achieved wall | History of goals the user has reached. |
| mockstores | Local test server that serves saved store pages so tests never call real stores. |

### 1.5 Assumptions
- Users are in India; prices are INR; the default time zone is `Asia/Kolkata` (stored per user).
- The main product is the mobile app (iOS + Android). An admin web panel exists for staff. A user web app and browser extension come in V2.
- One person per account. Shared lists (V2) link accounts; they never merge them.
- Store pages change without notice; extraction must fail softly and be easy to fix per store.

---

## 2. Users, roles and permissions

### 2.1 Roles
| Role | Who | Uses |
|---|---|---|
| `user` | Anyone who signs up in the app | Mobile app: their own Cart, Goals, money and settings |
| `admin` | Internal team | Admin web panel: stores, adapters, parser health, match review (V2), analytics, user support actions |

A user account is created on first successful sign-in. Admins are created by the seed or by another admin; they sign in to the admin panel with email + password + TOTP (§11.1).

### 2.2 Access principles
- A user sees and changes **only their own** records. Every query on a user-owned collection is filtered by `user`.
- A request for another user's record returns **404**, never 403, so ids cannot be probed.
- Admins do **not** read users' income, contributions, notes or item lists. They see aggregates and the shared Product catalogue. Support actions on an account (block, force logout, delete on request) are audited.
- Products, stores, categories (built-in) and price history are shared data; users read them only through their own cart items.
- In V2, shared lists give list members read (and optionally edit) access to the cart items in that list only — never to the owner's other cart items, goals or money.

### 2.3 Permission matrix
| Resource | user (own) | user (other's) | admin |
|---|---|---|---|
| Profile, settings | read/write | 404 | read basic profile, block/unblock, force logout |
| Cart items | full | 404 | none (aggregates only) |
| Goals | full | 404 | none (aggregates only) |
| Income, contributions | full | 404 | none |
| Custom categories | full | 404 | none |
| Built-in categories, stores | read | — | full |
| Products, price history | read via own cart items | — | read, fix, hide |
| Match reports (V2) | create, read own | 404 | review |
| Notifications | read/update own | 404 | none |
| Audit logs | none | none | read |
| Analytics | none | none | read |

### 2.4 Field-level visibility
- Product views sent to users never include `storageKey`s, parser debug data or `affiliateConfig`.
- User views sent to admins never include income, contributions, notes, `why`, cart item titles or goal titles.
- Cart item `notes` and goal `why` are free text: never logged, never in analytics, never in notifications.

---

## 3. System architecture

### 3.1 High-level view
```
 Mobile app (Expo)        Admin panel (React+Vite, Phase 6)
        │  HTTPS JSON              │
        └──────────────┬───────────┘
                 API service (Express)
        ┌──────────────┼──────────────┬───────────────┐
    MongoDB        Redis (BullMQ,     Object storage   Expo Push
  (replica set)    cache, limits)     (S3 / R2 / MinIO)  service
                       │
                Worker service (BullMQ)
      extraction · images · comparison · price refresh · notifications · jobs
                       │
          Store sites + affiliate APIs (tests: mockstores)
```
The API never fetches store pages except for the short synchronous `/extract` preview (3-second budget); everything else runs in the worker.

### 3.2 Tech stack
| Layer | Choice |
|---|---|
| Language | TypeScript (strict), ES modules; server imports use `.js` extensions (NodeNext) |
| Runtime | Node 24 LTS |
| Monorepo | npm workspaces: `server/`, `mobile/`, `shared/` (later `admin/`) |
| Server | Express 4 (pinned), Mongoose 8, Zod, Pino + pino-http, helmet, cors, compression, express-rate-limit, jsonwebtoken |
| Jobs | BullMQ on Redis (queues per job type; per-store rate limits) |
| Fetching / parsing | undici `fetch`, cheerio; Playwright (Chromium) only for JavaScript-rendered stores |
| Images | sharp (thumbnails); S3 SDK v3 against MinIO (local) / Cloudflare R2 (prod) |
| Mobile | Expo (latest SDK), Expo Router, Redux Toolkit + RTK Query, NativeWind (Tailwind for RN), react-hook-form + Zod, expo-secure-store, expo-image, expo-share-intent (share sheet), expo-notifications, expo-local-authentication |
| Shared | `shared/`: Zod schemas, enums and TypeScript types used by server and mobile |
| Admin (Phase 6) | React 18 + Vite + Tailwind v4 + RTK Query |
| Tests | Server: Vitest + Supertest + mongodb-memory-server (replica set). Mobile: jest-expo + React Native Testing Library. E2E: Maestro. API smoke: `npm run smoke` |
| Push | Expo Push Service (`expo-server-sdk`) |
| Monitoring | Sentry (server, worker, mobile), Pino logs |
| Analytics | PostHog (Phase 6) |

### 3.3 Backend layers and request lifecycle
```
request → requestId → pino-http → helmet → cors → compression → json(1mb)
        → apiLimiter → authenticate → authorize(...roles) → validate(Zod)
        → controller (thin, asyncHandler) → service (business rules, ownership)
        → model (Mongoose) → serializer (view) → sendSuccess
errors  → ApiError / ZodError / Mongoose errors → errorHandler → standard error body
```
- Controllers: parse input, call one service function, send the response.
- Services: all business rules, ownership checks, transactions, enqueuing jobs.
- Policies (`server/src/policies/`): ownership and admin rules.
- Serializers: the only way a document becomes a response.

### 3.4 Backend folder structure
```
server/
  src/
    app.ts  server.ts  worker.ts
    config/       env.ts  constants.ts  db.ts  redis.ts
    middlewares/  requestId  authenticate  authorize  validate  errorHandler  notFound  rateLimiters
    modules/<feature>/  model.ts service.ts controller.ts routes.ts validation.ts serializer.ts
    policies/     ownership.ts  admin.ts
    services/     audit  storage  push  sms  email  analytics
    adapters/     index.ts  generic/  <store>/          (store adapters, §9)
    jobs/         queues.ts  <name>.job.ts  scheduler.ts
    utils/        ApiError  ApiResponse  asyncHandler  pagination  money  dates  url  logger
    seed/         index.ts  <data>.seed.ts  expectations.json
    routes/       index.ts  health.routes.ts
  tests/          setup.ts  helpers/  fixtures/  *.test.ts
  smoke/          smoke.ts                           (npm run smoke)
mockstores/       server.ts  stores/<store>/*.html   (saved pages, §15.4)
shared/           src/schemas  src/enums  src/types
mobile/           app/ (Expo Router)  src/features  src/components/ui  src/store  src/utils
admin/            (Phase 6)
```

### 3.5 Mobile architecture
- **Expo Router** file-based routes (§13.1). Groups: `(auth)`, `(onboarding)`, `(tabs)`, plus stack screens.
- **State:** server data only through RTK Query (`src/store/api.ts`, base query with refresh mutex). Local UI state in slices. The access token lives in memory (Redux); the refresh token lives in **expo-secure-store** only.
- **Share intent:** `expo-share-intent` receives text/URLs shared from other apps and opens the Add sheet. Needs an Expo dev build (not Expo Go).
- **Offline:** RTK Query cache persisted for read-only viewing of the item list and dashboard (no money values in plain storage when the app lock is on — §11.2).
- **Feature folders:** `src/features/<feature>/` with `api.ts`, `components/`, `screens/`, `schemas.ts`.

### 3.6 Environment variables
Each variable is added to the Zod schema in `server/src/config/env.ts` and to `server/.env.example` (with a comment) **in the phase that first needs it**.

| Variable | Phase | Notes |
|---|---|---|
| `NODE_ENV` | 0 | development / test / production |
| `PORT` | 0 | API port; `.env.example` uses 5001 (macOS AirPlay holds 5000) |
| `MONGO_URI` | 0 | must be a replica set; optional in test |
| `REDIS_URL` | 0 | optional in test |
| `CLIENT_URLS` | 0 | comma-separated CORS allow-list (admin panel, later web app) |
| `LOG_LEVEL` | 0 | Pino level |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` | 0 | global API limiter |
| `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN` | 1 | ≥ 32 chars; default 15m |
| `REFRESH_TOKEN_TTL_DAYS` | 1 | default 30 |
| `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS` | 1 | default 300 / 5 |
| `SMS_TRANSPORT`, `SMS_API_KEY`, `SMS_SENDER_ID` | 1 | `console` (dev/test) or `msg91`/`twilio`; must not be `console` in production |
| `ALLOW_TEST_OTP` | 1 | `true` lets `+9100000000xx` use OTP `000000`; refused when `NODE_ENV=production` |
| `GOOGLE_CLIENT_IDS`, `APPLE_BUNDLE_ID` | 1 | ID-token audience checks |
| `AUDIT_HASH_SECRET` | 1 | HMAC for the audit chain |
| `ENCRYPTION_KEY` | 5 | 32-byte key (base64) for income/contribution amounts |
| `STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `PUBLIC_ASSET_URL` | 2 | MinIO locally, R2 in prod |
| `MAX_UPLOAD_MB` | 3 | default 10 |
| `FETCH_TIMEOUT_MS`, `EXTRACT_BUDGET_MS`, `PLAYWRIGHT_ENABLED` | 2 | defaults 8000 / 3000 / true |
| `MOCKSTORES_URL` | 2 | test/dev only: base URL that replaces real store hosts |
| `JOBS_ENABLED` | 2 | worker schedules repeatable jobs only when true |
| `EXPO_ACCESS_TOKEN` | 5 | Expo push |
| `SENTRY_DSN` | 6 | server + worker |
| `POSTHOG_KEY` | 6 | analytics |
| `AMAZON_PAAPI_*`, `FLIPKART_AFFILIATE_*` | 7 | comparison sources |
| `AFFILIATE_*` | 9 | per network |

Mobile uses `EXPO_PUBLIC_API_URL` (on a physical phone this is the computer's LAN IP, e.g. `http://192.168.1.20:5001/api/v1`).

### 3.7 Cross-cutting conventions
- API under `/api/v1`. JSON only. Response format: `{ success, message, data, meta }`; errors `{ success: false, message, error: { code, details }, requestId }`.
- **Money:** integer paise (`*Paise` fields, `Number`, safe up to ₹90 trillion) plus `currency: 'INR'`. Never floats. Formatting only at the edge (`formatINR`).
- **Dates:** instants stored in UTC; month-based values (income) use `month: 'YYYY-MM'`; "today" and monthly jobs use the user's `timezone`.
- Status changes use action endpoints (`POST /goals/:id/achieve`, `POST /cart/:id/bought`), not a generic status PATCH; every transition goes through `assertTransition()` (§5).
- **Cart and Goals are separate (D6):** separate collections (`cart_items`, `goals`), modules, endpoints, screens, categories and totals. No code path converts one into the other, and no endpoint, metric or screen adds their totals together.
- Enums and state machines live in `shared/src/enums` and are re-exported by `server/src/config/constants.ts`; the mobile app imports the same file.
- Lists use cursor pagination (`?cursor=&limit=`, `meta.nextCursor`) on user-facing feeds and page pagination (`?page=&limit=`) in the admin panel.
- No free text (cart notes, goal why, titles) and no money values in logs, analytics, audit metadata or push notification bodies.

---

## 4. Core workflows

The Cart and Goals workflows are separate. The share sheet and pasted links always go to the Cart; goals are only created in the Goals section.

### 4.1 Onboarding
1. Open the app → enter phone number (or Continue with Google / Apple).
2. Enter the 6-digit OTP → tokens issued; `isNewUser` decides the next screen.
3. New user: name → time zone (from device) → favourite stores (used by the Cart).
4. Optional monthly income and hours per month (default 176), explained as "used to show your goals in hours of work".
5. First goal: "What's one big thing you want to own?" (name, target price, optional photo). Skippable. Added in Phase 4.
6. Share tutorial (3 screens, skippable, shown once): how to add items to the Cart from store apps → Home.

### 4.2 Add to the Cart by sharing
1. In a store app, tap Share → ALLinONEcart. The Add-to-Cart sheet opens with a loading preview.
2. App calls `POST /extract { url }`. Server normalises the URL, finds the store, returns a preview (title, images, price, variants, suggested cart category).
3. User picks size / colour / storage / quantity, edits anything wrong, picks category and priority → Save (`POST /cart`).
4. The item appears in the Cart under its store ("my Myntra cart"). The worker caches images; in V2 it also starts the exact-match search.
5. If extraction fails: the sheet switches to manual entry with the URL kept (`EXTRACT_FAILED`).

Paste link (or the clipboard prompt "Add this link to your Cart?") follows the same steps from step 2.

### 4.3 Create a goal
Goals tab → New goal → title, target price, category (goal categories), horizon (suggested from the price), priority, optional target date, why, photo, optional reference link (opened in the browser for inspiration; never fetched or price-tracked) → Save. The goal shows its hours of work and a 0 % progress bar.

### 4.4 Browse the Cart
Cart tab: total in carts and item count at the top; segments **By store** (default – one section per store, e.g. "Myntra cart · 4 items · ₹8,960") and **By category**; search, filters, sort; grid or list; Bought history.

### 4.5 Browse goals
Goals tab: total of active goals, total saved and the next milestone at the top; segments **By horizon** (This year / Big goals / Life goals) and **By category**; vision board; achieved wall.

### 4.6 Save toward a goal
Goal → Add savings → amount (and optional note) → progress updates. The first contribution moves `active → saving`. Reaching 100 % offers "Mark achieved".

### 4.7 Buy a cart item
Cart item → Buy on store → opens the store app (universal link) or browser. On return the app asks "Did you buy it?" → Yes: price paid (pre-filled) and date → the item moves to Bought history. No: nothing changes. The user can also remove an item from the Cart.

### 4.8 Achieve a goal
Goal → Mark achieved → price paid, date, optional photo → Achieved wall + celebration.

### 4.9 Monthly check-in
1st of each month, 10:00 user time: push "Log last month's income". The user logs income → goals' hours of work and progress update → monthly summary on Home (Cart: added and bought; Goals: saved and achieved – shown separately).

### 4.10 Compare prices (V2, Phase 7)
Cart item → "Same product on other stores": offers lowest first with difference, stock, delivery and seller → Buy on any store, Switch store, or report "Wrong match". No match → "Only sold on <store>".

---

## 5. State machines

All machines live in `STATE_MACHINES` (shared enums). Every change calls `assertTransition(machine, from, to)` → 409 `INVALID_STATUS_TRANSITION` on a disallowed move, then a conditional update `{ _id, status: from }` so two requests cannot both win.

### 5.1 Cart item and goal status
The two sections have separate machines. No transition crosses from one section to the other.

**Cart item** (`STATE_MACHINES.cartItem`)
| From | To | Trigger |
|---|---|---|
| (new) | `in_cart` | Saved (V2: `waiting` when cooling-off applies, §8.9) |
| `waiting` | `in_cart` | Cooling-off ends (job) |
| `in_cart`, `waiting` | `bought` | `POST /cart/:id/bought` |
| `in_cart`, `waiting` | `removed` | `POST /cart/:id/remove` |
| `removed` | `in_cart` | `POST /cart/:id/restore` |
| `bought` | `in_cart` | `POST /cart/:id/unbuy` (undo within 7 days) |

**Goal** (`STATE_MACHINES.goal`)
| From | To | Trigger |
|---|---|---|
| (new) | `active` | Goal created |
| `active` | `saving` | First contribution |
| `saving` | `active` | All contributions removed |
| `active`, `saving` | `achieved` | `POST /goals/:id/achieve` |
| `active`, `saving` | `dropped` | `POST /goals/:id/drop` |
| `dropped` | `active` or `saving` | `POST /goals/:id/restore` (saving if contributions exist) |
| `achieved` | `active` or `saving` | `POST /goals/:id/unachieve` (undo within 7 days) |

Each change appends to `statusHistory: [{ from, to, at }]`.

### 5.2 Comparison status (on cart items, V2)
`not_applicable` (feature off) · `pending` → `ready` (≥ 1 other store) | `none` (only sold on one store) | `failed` (retry later) → `pending` again on refresh.

### 5.3 Match report (V2)
`open` → `confirmed_wrong` (product removed from the group, exclusion rule added) | `dismissed`.

### 5.4 Alert (V2)
`active` → `triggered` (notification sent; `price_below` re-arms when the price goes back above the threshold) → `active`; any → `disabled` by the user.

### 5.5 User account
`active` → `blocked` (admin) → `active`; `active` → `deletion_pending` (user requested; login refused) → purged after 30 days by a job. Blocking or deletion revokes all sessions.

---
## 6. Data model (MongoDB schemas)

### 6.1 Conventions
- Collections are plural snake_case; models are singular PascalCase.
- Every schema has `timestamps: true` (`createdAt`, `updatedAt`). Ids are ObjectIds.
- Money: `<name>Paise: Number` (integer, validated with `Number.isSafeInteger` and ≥ 0) + `currency: 'INR'`.
- User-owned collections have `user: ObjectId` (indexed) and every query filters by it.
- Enums come from `shared/src/enums`; never inline string lists in schemas.
- Multi-document writes use transactions (`withTransaction`); MongoDB must run as a replica set everywhere, including tests.
- Shared vs. per-user: **Product** is shared (one per store URL); **cart items** and **goals** are per user. Many cart items point to one Product.

### 6.2 Entity relationships
```
Cart section                                   Goals section
User 1─* CartItem *─1 Product *─1 Store         User 1─* Goal 1─* Contribution
         CartItem *─1 Category(section=cart)          Goal *─1 Category(section=goal)
         Product *─0..1 MatchGroup (V2)          User 1─* IncomeEntry
         Product 1─* PriceHistory (V2)
         CartItem 1─* Alert (V2)                       Goal 1─* Alert (target_date, V2)

Shared: User 1─* Session · User 1─* Device · User 1─* Notification · AuditLog · ExtractionLog
```
`cart_items` and `goals` are separate collections with separate models; there is no shared "item" model and no field that links a cart item to a goal.

### 6.3 `users`
| Field | Type | Notes |
|---|---|---|
| role | enum `user` \| `admin` | default `user` |
| status | enum `active` \| `blocked` \| `deletion_pending` | §5.5 |
| phone | String, E.164, unique sparse | |
| email | String, lowercase, unique sparse | Google/Apple or admin |
| authProviders | [{ provider: `phone`\|`google`\|`apple`, subject }] | unique index on `provider + subject` |
| name | String | |
| timezone | String (IANA) | default `Asia/Kolkata` |
| currency | String | `INR` |
| hoursPerMonth | Number | default 176, 40–400 |
| monthlyIncomePaise | Number (encrypted, Phase 5) | profile default; income entries override |
| favouriteStores | [ObjectId → Store] | |
| onboarding | { completedAt, tutorialSeenAt } | |
| settings | { notifications: { [type]: Boolean }, quietHours: { start: 'HH:mm', end }, hideAmounts: Boolean, appLock: Boolean } | |
| consent | { termsAcceptedAt, privacyVersion, analytics: Boolean } | |
| plan | enum `free` \| `premium` | V2 |
| passwordHash, totpSecret | String, `select: false` | admins only |
| lastLoginAt | Date | |
| deletionRequestedAt | Date | |

### 6.4 `sessions`
`user`, `family` (one login on one device), `refreshTokenHash` (SHA-256), `expiresAt` (sliding 30 days), `revokedAt`, `revokeReason` (`logout` \| `logout_all` \| `rotated` \| `reuse_detected` \| `blocked` \| `deleted`), `device: { platform, model, appVersion }`, `lastUsedAt`, `ipHash`. Rotation on every refresh; reusing a rotated token outside a 10-second grace window revokes the whole family.

### 6.5 `otp_challenges`
`phone`, `codeHash` (SHA-256 of code + phone + secret), `expiresAt` (TTL index), `attempts`, `consumedAt`, `ipHash`. One active challenge per phone; a new request replaces it.

### 6.6 `stores`
| Field | Type | Notes |
|---|---|---|
| key | String, unique | `zara`, `myntra`, `amazon_in` … (adapter folder name) |
| name | String | display name |
| domains | [String] | `zara.com`, `www.zara.com` |
| logoUrl | String | |
| adapter | enum `generic` \| `custom` | |
| needsBrowser | Boolean | use Playwright |
| supportsComparison | Boolean | V2 |
| affiliate | { network, tag, urlTemplate } | `select: false`; V2 |
| isActive | Boolean | |
| rateLimitPerMinute | Number | worker limiter, default 30 |

### 6.7 `categories`
`user` (null = built-in), `section` (`cart` | `goal`), `key`, `name`, `icon` (lucide name), `colour` (token name), `sortOrder`, `isActive`. Unique `{ user, section, name }` (case-insensitive collation). A cart item may only use a `cart` category and a goal only a `goal` category.

Built-ins:
- **cart:** `fashion`, `electronics`, `beauty`, `home`, `sports`, `books`, `other`
- **goal:** `vehicles`, `property`, `travel`, `education`, `gadgets`, `experiences`, `other`

### 6.8 `products` (shared)
| Field | Type | Notes |
|---|---|---|
| store | ObjectId → Store | |
| canonicalUrl | String | unique with `store` |
| title, brand, model | String | |
| variant | { storage, size, colour, condition, region } | strings, normalised lower case |
| availableVariants | { sizes: [], colours: [], storage: [] } | from the page, for the pickers |
| identifiers | { gtin, mpn, sku } | |
| images | [{ sourceUrl, storageKey (`select: false`), url, thumbUrl }] | cached copies |
| pricePaise, currency | Number, String | latest |
| inStock | Boolean | |
| lastCheckedAt, nextCheckAt | Date | V2 scheduler |
| activeCartCount | Number | cart items in in_cart/waiting pointing here (§8.6) |
| matchGroup | ObjectId → MatchGroup | V2 |
| extraction | { method: `api`\|`jsonld`\|`og`\|`custom`, partial: Boolean } | |

### 6.9 `cart_items` and `goals`
Two collections, two models, two modules (`modules/cart`, `modules/goals`). They share only small embedded helpers (image, statusHistory).

**`cart_items`**
| Field | Type | Notes |
|---|---|---|
| user | ObjectId → User | indexed |
| product | ObjectId → Product | required |
| store | ObjectId → Store | copied from the Product for grouping |
| sourceUrl | String | as shared |
| title | String, 1–200 | user-editable copy |
| imageUrl | String | product image |
| pricePaise | Number | price when saved/edited (the Product holds the live price) |
| currency | String | |
| quantity | Number, 1–99 | |
| selectedVariant | { size, colour, storage } | |
| category | ObjectId → Category (section `cart`) | |
| priority | enum | |
| status | enum | §5.1 cart machine |
| statusHistory | [{ from, to, at }] | |
| notes | String ≤ 1000 | never logged |
| coolingOffUntil | Date | V2 |
| bought | { at, paidPaise } | |
| removedAt | Date | |
| comparison | { status, updatedAt } | V2 (§5.2) |
| hiddenOffers | [ObjectId → Product] | V2 wrong-match reports |
| sortOrder | Number | V2 |
| lastViewedAt | Date | V2 "still want this?" |

Indexes: `{ user, status, store }`, `{ user, createdAt: -1 }`, `{ user, category }`, `{ product }`.

**`goals`**
| Field | Type | Notes |
|---|---|---|
| user | ObjectId → User | indexed |
| title | String, 1–200 | |
| targetPaise | Number | target price |
| currency | String | |
| horizon | enum `this_year` \| `big_goal` \| `life_goal` | |
| category | ObjectId → Category (section `goal`) | |
| priority | enum | |
| status | enum | §5.1 goal machine |
| statusHistory | [{ from, to, at }] | |
| savedPaise | Number | sum of contributions (denormalised, kept in the same transaction) |
| targetDate | Date (calendar date) | optional |
| why | String ≤ 1000 | never logged |
| photo | { storageKey (`select: false`), url, thumbUrl } | |
| referenceUrl | String | optional inspiration link; never fetched by the server |
| achieved | { at, paidPaise, photo } | |
| droppedAt | Date | |
| sortOrder | Number | V2 |

Indexes: `{ user, status, horizon }`, `{ user, createdAt: -1 }`, `{ user, category }`.

### 6.10 `income_entries`
`user`, `month` ('YYYY-MM', unique with user), `amountPaise` (encrypted at field level, Phase 5), `source` (`salary` \| `freelance` \| `business` \| `other`), `note`.

### 6.11 `contributions`
`user`, `goal`, `amountPaise` (> 0; encrypted, Phase 5), `date`, `note`. Goals only. Deleting a contribution is allowed (it is the user's own ledger); the goal's `savedPaise` and status update in the same transaction.

### 6.12 `devices`
`user`, `expoPushToken` (unique), `platform`, `appVersion`, `lastSeenAt`, `disabledAt` (set when Expo reports `DeviceNotRegistered`).

### 6.13 `notifications`
`user`, `type`, `title`, `body`, `data` (allow-listed ids only), `link` (app route), `dedupeKey` (unique with user), `channels: { push: { status, sentAt, ticketId }, inApp: true }`, `heldUntil` (quiet hours), `readAt`.

### 6.14 `audit_logs` (append-only)
`seq`, `at`, `action` (§11.4), `actor: { user, role }`, `target: { type, id }`, `request: { requestId, ipHash, userAgent }`, `metadata` (ids and field names only), `prevHash`, `hash` (HMAC chain). All update/delete paths are blocked by model hooks (409 `RECORD_LOCKED`).

### 6.15 `extraction_logs` (TTL 30 days)
`store`, `host`, `ok`, `method`, `reason` (`timeout` \| `blocked` \| `no_price` \| `parse_error` \| `http_<code>`), `durationMs`, `at`. Feeds parser health (§9.6). Never stores page content or the full URL query string.

### 6.16 V2 collections
- `price_history`: `product`, `pricePaise`, `inStock`, `at`. Index `{ product, at: -1 }`; time-series collection.
- `match_groups`: `fingerprint` (unique), `brand`, `model`, `variantKey`, `gtin`, `products: [ObjectId]`, `checkedAt`.
- `match_reports`: `user`, `cartItem`, `product`, `reason`, `status` (§5.3), `reviewedBy`, `reviewedAt`.
- `alerts`: `user`, `cartItem` (price types) or `goal` (`target_date`), `type` (`price_below` \| `back_in_stock` \| `cheaper_elsewhere` \| `target_date`), `thresholdPaise`, `status` (§5.4), `lastTriggeredAt`.
- `affiliate_clicks`: `user`, `cartItem`, `product`, `store`, `at`.
- `lists`, `list_items`, `list_members`, `tags`: Phase 10 (spec written in Phase 10).

---

## 7. REST API specification

### 7.1 Conventions
- Base path `/api/v1`. Auth: `Authorization: Bearer <access token>`.
- Success: `{ success: true, message, data, meta? }`. Error: `{ success: false, message, error: { code, details? }, requestId }`; validation `details` = `[{ field: 'body.title', message }]`.
- Money fields end in `Paise`; dates are ISO 8601 UTC; `month` is `YYYY-MM`.
- Unknown body fields are stripped by `validate()`.
- Rate limits: global 300 req / 15 min / IP; auth and extract have their own (§11.1, §9.3).

### 7.2 Health — Phase 0
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ status: 'ok', uptime, timestamp, db, redis }`; always 200 while the API runs |

### 7.3 Auth — `/auth` (Phase 1)
| Method | Path | Body / notes |
|---|---|---|
| POST | `/auth/otp/request` | `{ phone }` → `{ resendAfterSeconds }`; always the same response (no enumeration) |
| POST | `/auth/otp/verify` | `{ phone, code, device }` → `{ accessToken, refreshToken, user, isNewUser }` |
| POST | `/auth/oauth/google` | `{ idToken, device }` → same as verify |
| POST | `/auth/oauth/apple` | `{ identityToken, nonce, name?, device }` → same |
| POST | `/auth/refresh` | `{ refreshToken }` → new pair (rotation) |
| POST | `/auth/logout` | revokes the current family |
| POST | `/auth/logout-all` | revokes every session |
| GET | `/auth/sessions` | list own sessions |
| DELETE | `/auth/sessions/:id` | revoke one |
| POST | `/admin/auth/login` | admin panel: `{ email, password, totp }` |

### 7.4 Me — `/me` (Phase 1; export/delete Phase 5)
| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/me` | profile, settings, onboarding fields |
| POST | `/me/onboarding/complete` | sets `onboarding.completedAt` |
| GET | `/me/export` | `?format=json\|csv` (Phase 5) |
| POST | `/me/delete` | `{ confirm: 'DELETE' }` → `deletion_pending` (Phase 5) |

### 7.5 Stores, categories, uploads (Phases 2–4)
| Method | Path | Notes |
|---|---|---|
| GET | `/stores` | active stores (public fields) |
| GET / POST | `/categories` | `?section=cart\|goal`; built-in + own; create own (with `section`) |
| PATCH / DELETE | `/categories/:id` | own only; delete moves that section's items/goals to its `other` |
| POST | `/uploads` | `{ purpose: 'goal_photo' \| 'achieved_photo', contentType, size }` → signed PUT URL + `uploadId` |

### 7.6 Capture — Phase 2
| Method | Path | Notes |
|---|---|---|
| POST | `/extract` | `{ url }` → `{ preview: { store, canonicalUrl, title, brand, images, pricePaise, currency, inStock, availableVariants, suggestedCategory }, partial, productId? }`. Never saves a cart item. |

### 7.7 Cart — `/cart` (Phase 3)
| Method | Path | Notes |
|---|---|---|
| POST | `/cart` | `{ url \| productId, title?, pricePaise?, selectedVariant, quantity, category, priority, notes?, allowDuplicate? }` |
| GET | `/cart` | filters `status` (default active = in_cart/waiting), `store, category, q`; sort `newest \| price_asc \| price_desc \| priority`; cursor pagination; `meta.totals` for the current filter |
| GET | `/cart/groups` | `?by=store\|category` → `[{ key, label, logoUrl?, count, totalPaise }]` (active items) |
| GET | `/cart/bought` | bought history, cursor pagination |
| GET | `/cart/:id` | cart item view with the Product's live price |
| PATCH | `/cart/:id` | editable fields only (no status) |
| DELETE | `/cart/:id` | hard delete |
| POST | `/cart/:id/bought` · `/unbuy` · `/remove` · `/restore` | §5.1 |
| GET | `/cart/:id/buy-link` | the URL to open (affiliate from Phase 9) |

### 7.7a Goals — `/goals` (Phase 4)
| Method | Path | Notes |
|---|---|---|
| POST | `/goals` | `{ title, targetPaise, horizon, category, priority, targetDate?, why?, uploadId?, referenceUrl? }` |
| GET | `/goals` | filters `status` (default active = active/saving), `horizon, category, q`; sort `newest \| target_asc \| target_desc \| priority \| closest`; cursor pagination; `meta.totals` |
| GET | `/goals/groups` | `?by=horizon\|category` → `[{ key, label, count, totalPaise, savedPaise }]` |
| GET | `/goals/:id` | goal view incl. hours of work and progress |
| PATCH | `/goals/:id` | editable fields only (no status, no savedPaise) |
| DELETE | `/goals/:id` | hard delete with its contributions (one transaction) |
| POST | `/goals/:id/achieve` · `/unachieve` · `/drop` · `/restore` | §5.1 |
| GET / POST | `/goals/:id/contributions` | |
| DELETE | `/contributions/:id` | |

### 7.8 Home, income and goal views — Phase 4
| Method | Path | Notes |
|---|---|---|
| GET / POST | `/income` | list / upsert by month |
| DELETE | `/income/:month` | |
| GET | `/dashboard` | §14 – `{ cart: {…}, goals: {…} }`, never a combined total |
| GET | `/goals/vision-board` | active goals' images and titles only, no prices |
| GET | `/goals/achieved` | achieved wall, cursor pagination |

### 7.9 Notifications — Phase 5
| Method | Path | Notes |
|---|---|---|
| POST | `/devices` | register Expo push token |
| DELETE | `/devices/:token` | on logout |
| GET | `/notifications` | inbox, cursor pagination |
| GET | `/notifications/unread-count` | |
| POST | `/notifications/:id/read` · `/notifications/read-all` | |

### 7.10 Admin — `/admin` (Phase 6)
`GET /admin/stores`, `PATCH /admin/stores/:id`, `GET /admin/parser-health`, `GET /admin/extraction-logs`, `GET /admin/users` (basic profile only), `POST /admin/users/:id/block` · `/unblock` · `/logout-all`, `GET /admin/audit-logs`, `GET /admin/audit-logs/verify`, `GET /admin/metrics` (aggregates).

### 7.11 Comparison — Phase 7 (V2)
`GET /cart/:id/offers` (status + offers lowest first), `POST /cart/:id/offers/refresh` (once per 15 min per item), `POST /cart/:id/switch-store { productId }`, `POST /cart/:id/match-reports { productId, reason }`, `GET /admin/match-reports`, `POST /admin/match-reports/:id/confirm` · `/dismiss`.

### 7.12 Later V2 endpoints
Alerts (`/alerts`, Phase 8), `GET /go/:productId` affiliate redirect and subscriptions (Phase 9), projections, lists, tags, sharing (Phase 10).

---

## 8. Business rules

### 8.1 Money
- All amounts are integer paise. Inputs from the app are paise (the app converts with `rupeesToPaise`). Max single amount ₹100 crore (`1_000_000_000_000` paise).
- Totals are sums of `pricePaise × quantity`. Never divide money except for hours of work (§8.3), which is not money.

### 8.2 Totals
Cart and Goals totals are separate numbers. No endpoint, metric or screen adds them together.

**Cart**
- **Active cart items** = status `in_cart` or `waiting`.
- **Cart total** = Σ active cart items' `pricePaise × quantity` (overall, per store, per category).
- **Bought** = Σ `bought.paidPaise` (this month and this year, user's time zone).
- Removed items count in nothing.

**Goals**
- **Active goals** = status `active` or `saving`.
- **Goals total** = Σ active goals' `targetPaise` (overall, per horizon, per category).
- **Saved** = Σ active goals' `savedPaise`.
- **Achieved** = Σ achieved goals' `achieved.paidPaise` (all time and this year).
- Dropped goals count in nothing.

### 8.3 Hours of work (Goals only)
- `monthlyIncome` = the latest `income_entries` month, else `users.monthlyIncomePaise`, else none.
- `hourlyPaise = monthlyIncome / hoursPerMonth`. `hours = (targetPaise − savedPaise) / hourlyPaise` (remaining cost).
- Display: < 1 h → "under 1 hour"; < 8 h → hours (1 decimal); < `hoursPerMonth` → days of 8 h (1 decimal); < 12 × `hoursPerMonth` → months (1 decimal); else years (1 decimal).
- No income → `hoursOfWork: null` and the app hides it. Computed on the server in `utils/hoursOfWork.ts`; the app never recomputes it. Cart items don't show hours of work.

### 8.4 Next milestone (Goals only)
Among active goals, `remaining = targetPaise − savedPaise`. Next milestone = smallest positive `remaining`; ties → earliest `createdAt`. Goals with `remaining ≤ 0` show "Ready to achieve" instead.

### 8.5 Suggestions (rule-based)
- **Cart category** (Phase 2, from `/extract`): store default (Zara → fashion, Croma → electronics, Nykaa → beauty …), then keyword rules on title and breadcrumb; fallback `other`.
- **Goal horizon** (Phase 4, as the user types the target price): ≥ ₹1,00,00,000 → `life_goal`; ≥ ₹10,00,000 → `big_goal`; else `this_year`.
- **Goal category** (Phase 4): keyword rules on the title (car, bike → vehicles; flat, house, plot → property; trip, tour → travel …); fallback `other`.
- Rules live in `server/src/config/suggestions.ts` with unit tests. AI suggestions replace them in Phase 10.

### 8.6 Products (Cart only)
- One Product per `{ store, canonicalUrl }` (unique index). Saving a URL that already exists links to it; a fresh price check is skipped if `lastCheckedAt` < 6 h.
- `activeCartCount` (number of `in_cart`/`waiting` cart items pointing at the Product) is updated in the same transaction as cart item create/status change/delete; products with 0 are not price-checked (V2).

### 8.7 Duplicates (Cart only)
Saving a cart item whose Product is already in the user's active cart returns 409 `DUPLICATE_ITEM` with `details.cartItemId` (the app offers "Open it" or "Save anyway" with `allowDuplicate: true`). Goals have no duplicate check.

### 8.8 Limits
- Free plan (from Phase 9): 50 active cart items and 20 active goals. Before Phase 9, safety caps of 500 and 100. Over → 422 `ITEM_LIMIT_REACHED` with `details.section`.
- Custom categories: 30 per user per section. Contributions: 1,000 per goal. Photos: 10 MB, JPEG/PNG/WebP/HEIC (magic-byte check).

### 8.9 Cooling-off (Cart only, V2, Phase 10)
New cart items under the user's threshold (default ₹5,000) start in `waiting` for 7 days; the Buy button is muted with a countdown. Job `cooling_off_release` moves them to `in_cart`.

### 8.10 Notifications
At most 3 push notifications per user per day (extra ones are in-app only); quiet hours default 22:00–08:00 user time (held until the end); per-type switches; every job notification has a `dedupeKey` (§12).

### 8.11 Background jobs (BullMQ, worker)
| Job | Phase | Trigger | Notes |
|---|---|---|---|
| `cache_images` | 2 | Product created / images changed | copy to storage, 400 px WebP thumb |
| `extract_product` | 2 | `/extract` timed out | retry extraction, update Product |
| `parser_health` | 2 | every hour | success rate per store; log + admin flag < 90 % |
| `purge_extraction_logs` | 2 | TTL index | — |
| `monthly_checkin` | 5 | daily at 10:00 per time zone bucket | sends on the 1st in the user's zone |
| `send_push` | 5 | notification created | Expo push, receipts checked after 15 min |
| `purge_deleted_accounts` | 5 | daily | 30 days after `deletionRequestedAt` |
| `find_exact_matches` | 7 | cart item saved / stale | §10 |
| `refresh_price` | 8 | `nextCheckAt` due | §10.5 intervals |
| `evaluate_alerts` | 8 | after each price change | |
| `cooling_off_release`, `stale_cart_check` | 10 | daily / weekly | Cart only |

Jobs are idempotent, retry 3× with exponential backoff, log one summary line, and never throw out of the processor. Repeatable jobs register only when `JOBS_ENABLED=true`. Tests call the exported `runX(now)` functions with a fixed `now`.

---
## 9. Product extraction and store adapters

### 9.1 Capture channels
| Channel | Phase | How |
|---|---|---|
| Share sheet | 3 | `expo-share-intent` receives the shared URL/text; the app pulls the first `http(s)` URL out of the text |
| Paste link + clipboard prompt | 3 | the app checks the clipboard on focus (iOS paste permission respected) |
| Goals | 4 | not a capture channel: goals are created by hand in the Goals section and never come from the share sheet |
| Browser extension | 11 | V2 |

### 9.2 URL normalisation (`utils/url.ts`)
1. Pull the first URL out of shared text; reject non-`http(s)`.
2. Follow redirects / short links (max 5, `HEAD` then `GET`), through the safe fetcher (§11.3).
3. Lower-case the host, drop `www.` for matching only, drop the fragment.
4. Remove tracking parameters: `utm_*`, `gclid`, `fbclid`, `ref`, `ref_`, `tag`, `affid`, `affExtParam*`, `srsltid`, plus store-specific lists from the adapter.
5. Let the adapter canonicalise (e.g. Amazon → `/dp/<ASIN>`; Flipkart keeps `pid`).

### 9.3 Extraction pipeline (`POST /extract`)
1. Normalise → find the Store by domain (unknown → `generic` adapter, store `unknown`).
2. Product exists with `lastCheckedAt` < 6 h → return it (no fetch).
3. Fetch within `EXTRACT_BUDGET_MS` (3 s): plain HTTP; Playwright only if `store.needsBrowser`.
4. Parse in order: affiliate API (V2) → JSON-LD `schema.org/Product` → Open Graph / meta → adapter selectors.
5. Build variants and identifiers; suggest a cart category (§8.5).
6. Upsert the Product (by `store + canonicalUrl`), enqueue `cache_images`, write an `extraction_logs` row.
7. Timeout → `partial: true` preview (store, URL, anything found) + enqueue `extract_product`. Hard failure → 422 `EXTRACT_FAILED` with `details.url` so the app can switch to manual entry.
8. Rate limit: 30 extracts / 10 min per user.

### 9.4 Adapter interface (`server/src/adapters/<store>/index.ts`)
```ts
export interface StoreAdapter {
  key: string;                                  // matches stores.key
  matches(url: URL): boolean;
  canonicalise(url: URL): URL;
  needsBrowser?: boolean;
  extract(page: { html: string; url: URL }): Partial<ExtractedProduct>; // on top of the generic parser
  search?(query: SearchQuery): Promise<Candidate[]>;                   // V2 (Phase 7)
  affiliateUrl?(url: URL, config: AffiliateConfig): URL;               // V2 (Phase 9)
}
```
The generic parser always runs first; adapters only fill gaps or correct fields. One adapter failing never affects another.

### 9.5 MVP stores (Phase 2)
Amazon, Flipkart, Myntra, Ajio, Nykaa, Zara, H&M, Bear House, Snitch, The Souled Store + the generic parser for everything else. Each adapter ships with ≥ 2 saved fixture pages (§15.4).

### 9.6 Parser health
Every extraction writes an `extraction_logs` row. Job `parser_health` (hourly) computes the success rate per store for the last 24 h; below 90 % → warning log + flag in the admin panel. `npm run adapters:live` (manual, not in CI) tries one real URL per store.

---

## 10. Exact-match price comparison (V2, Phase 7)

### 10.1 Definition
Two Products are an exact match only if **all** are equal after normalisation: brand, model, storage or size, colour, condition (`new` only; refurbished/renewed/used/open-box excluded) and region (Indian model; "international version" excluded). A missing store is acceptable; a wrong match is not.

### 10.2 Pipeline (`find_exact_matches`)
1. Trigger: cart item saved, or the group is older than its refresh interval.
2. Product already in a fresh MatchGroup → done.
3. Fingerprint: `brand|model|storage|colour|condition|region`, e.g. `apple|iphone 18|256gb|black|new|in`; keep GTIN/MPN.
4. Candidates: Amazon PA-API, Flipkart Affiliate API, then `search()` of comparison stores (Croma, Reliance Digital, Vijay Sales, Tata CLiQ, Myntra, Ajio, brand sites).
5. Extract each candidate with the normal pipeline.
6. Score: same GTIN/MPN → match (1.0); all fingerprint fields equal → match (0.9); anything missing or different → reject. Title words refurbished / renewed / used / pre-owned / international → reject.
7. Join accepted Products to the MatchGroup; set `cart_items.comparison.status`; notify when a cheaper store exists.

### 10.3 Normalisation
Lower case; strip punctuation and filler words; units (`256 GB`, `256GB`, `256 gigabytes` → `256gb`); brand colour synonyms; admin-maintained model aliases and exclusion rules (`server/src/config/matching/`).

### 10.4 Offers display
Lowest first, "Lowest price" badge, difference from the saved price, stock, delivery, seller (authorised or not), "Last checked X ago". Out-of-stock rows last. Prices > 40 % below the group median are hidden pending review. No other store → "Only sold on <store>".

### 10.5 Refresh intervals (Phase 8)
| Price | Interval |
|---|---|
| > ₹50,000 | 6 h |
| ₹5,000 – ₹50,000 | 12 h |
| < ₹5,000 | 24 h |
| ≥ 100 active cart items | 3 h |
| Sale season | halved |

### 10.6 Quality
Labelled match set (`server/tests/fixtures/matching/pairs.json`, ≥ 60 pairs); CI fails if precision < 99 %. Wrong-match reports hide the offer for that user at once and go to the admin queue.

---

## 11. Security, privacy and audit

### 11.1 Authentication and sessions
- Phone OTP: 6 digits, `OTP_TTL_SECONDS` (300), `OTP_MAX_ATTEMPTS` (5) then the challenge is burnt; resend after 30 s; 5 requests / hour / phone and 20 / hour / IP. Codes stored hashed; compared in constant time.
- Test numbers `+9100000000xx` accept `000000` only when `ALLOW_TEST_OTP=true` and `NODE_ENV !== 'production'` (config refuses to start otherwise).
- Google / Apple: verify ID tokens (audience, issuer, expiry, Apple nonce). Linking an OAuth identity to an existing phone account requires being signed in.
- Access token: JWT, 15 min, `{ sub, role, sid }`. Refresh token: 64 random bytes, SHA-256 stored, rotated on every refresh, sliding 30 days, reuse detection (§6.4). Mobile keeps it in SecureStore only.
- `authenticate` checks the session on every request so revocation is immediate; blocked / deletion-pending users get 401 `ACCOUNT_INACTIVE`.
- Admin panel: email + password (bcrypt, 12 rounds) + TOTP; 5 failed logins → 15-minute lock.

### 11.2 Data protection
- HTTPS only; HSTS on the admin panel.
- `income_entries.amountPaise`, `contributions.amountPaise` and `users.monthlyIncomePaise` are encrypted at field level (AES-256-GCM, `ENCRYPTION_KEY`) from Phase 5; aggregation over them happens in the service after decryption.
- Uploads: signed PUT URLs, type by magic bytes, size limit, random keys; never served from the API filesystem.
- App lock (Phase 5): PIN / Face ID / fingerprint via `expo-local-authentication`; locks after 60 s in the background; the cached money values are cleared from the persisted cache when the lock is on.
- Hide-amounts mode (V2) blurs prices.

### 11.3 Input, output and fetching
- Zod on every input; unknown fields stripped.
- The fetcher (`services/fetcher.ts`) blocks private, loopback, link-local and metadata IP ranges after DNS resolution and on every redirect (server-side request forgery protection), limits response size (5 MB) and time, and sends a fixed user agent.
- Store HTML is parsed, never rendered or stored; extracted strings are length-limited and stripped of markup.
- Responses go through serializers only.

### 11.4 Audit log
Append-only with an HMAC hash chain (`AUDIT_HASH_SECRET`). Writes happen after the main write succeeds and never fail the request. Metadata: ids and field names only.

Actions: `auth.login`, `auth.login_failed` (admin), `auth.otp_locked`, `auth.refresh_reuse`, `auth.logout`, `auth.logout_all`, `session.revoke`, `user.update_profile`, `user.export`, `user.delete_request`, `user.purged`, `admin.user_block`, `admin.user_unblock`, `admin.user_logout_all`, `admin.store_update`, `admin.product_hide`, `admin.match_review` (V2), `access.denied`.

Cart, goal and money changes are the user's own data and are **not** audited (they are visible in the app and exportable).

### 11.5 Privacy (India DPDP Act 2023)
- Consent at sign-up (terms + privacy version); analytics consent separate and off by default.
- Export (JSON/CSV) and deletion (30-day purge) in the app.
- Analytics events never carry titles, notes, prices, income or URLs (§15.5).
- Affiliate disclosure near Buy buttons (Phase 9).
- Grievance contact in settings.

### 11.6 Logging
Never log request bodies, tokens, OTPs, phone numbers, URLs with query strings, item text or money values. Errors are logged through `serializeError()` (name, message, stack). Request logs record method, path (no query), status and duration.

---

## 12. Notifications

| Type | Phase | Example | Default |
|---|---|---|---|
| `monthly_checkin` | 5 | "Log October's income to update your goals" | on |
| `milestone_ready` | 5 | "You've saved enough for one of your goals" (Goals) | on |
| `comparison_ready` | 7 | "An item in your cart is cheaper on 2 other stores" (Cart) | on |
| `price_drop` | 8 | "An item in your cart dropped in price" (Cart) | on |
| `back_in_stock` | 8 | "An item in your cart is back in stock" (Cart) | on |
| `target_date` | 8 | "30 days left for one of your goals" (Goals) | on |
| `daily_motivation` | 10 | one goal photo with progress | off |

Rules: titles and bodies never include item titles, prices, income or notes (the lock screen is public); `data` holds ids only; deep link to the right screen; 3 pushes / day; quiet hours; per-type switches; `dedupeKey` = `<type>:<record id>[:<version>]` so retries never send twice. Push through Expo; tokens disabled on `DeviceNotRegistered`.

---

## 13. Mobile app specification

### 13.1 Route map (Expo Router)
Cart and Goals are separate tabs with separate screens; no screen lists both.
```
app/
  (auth)/phone.tsx  otp.tsx                                     Phase 1
  (onboarding)/profile.tsx stores.tsx income.tsx tutorial.tsx   Phase 3 (first-goal.tsx Phase 4)
  (tabs)/_layout.tsx
    index.tsx        Home: separate Cart card and Goals card    Phase 4
    cart.tsx         Cart (by store / by category)              Phase 3
    goals.tsx        Goals (by horizon / by category)           Phase 4
    profile.tsx      Profile & settings                         Phase 1 (grows)
  cart/add.tsx (modal, share intent target)  cart/[id].tsx  cart/[id]/edit.tsx  cart/bought.tsx   Phase 3
  goals/new.tsx  goals/[id].tsx  goals/[id]/edit.tsx  goals/[id]/achieve.tsx
  goals/vision.tsx  goals/achieved.tsx  income.tsx                                           Phase 4
  notifications.tsx  settings/sessions.tsx  settings/notifications.tsx  settings/privacy.tsx  settings/app-lock.tsx
  dev/health.tsx                                                Phase 0 (dev builds only)
```

### 13.2 State
RTK Query for all server data with tags (`Me`, `CartItem`, `CartGroups`, `Goal`, `GoalGroups`, `Dashboard`, `Income`, `Notification`…); mutations invalidate tags. Access token in memory; refresh token in SecureStore; a refresh mutex retries one 401 per request.

### 13.3 UI guidelines
- NativeWind with design tokens in `mobile/tailwind.config.js` (`bg-canvas`, `text-ink`, `text-muted`, `border-line`, `primary-*`, `rounded-card`); light and dark themes; never raw hex in components.
- Kit in `src/components/ui`: `Screen`, `Header`, `Button`, `TextField`, `MoneyField` (types ₹, value paise), `Select`, `Segmented`, `Card`, `CartItemCard`, `GoalCard`, `ProgressBar`, `StatTile`, `EmptyState`, `ErrorState`, `Skeleton`, `Sheet`, `Toast`, `StatusPill`.
- Every screen has loading, empty and error states; pull-to-refresh on lists.
- Accessibility: labels on every touchable, dynamic type up to 200 %, 44 pt touch targets, colour never the only signal.
- Smallest supported width 360 pt; no horizontal scroll.
- Motion 150–250 ms; respect "reduce motion". Celebrations are skippable.

### 13.4 Key screens (must-haves)
Phone + OTP · onboarding · Home (Cart card + Goals card) · **Cart**: by store / by category, Add-to-Cart sheet (preview, variants, manual fallback), cart item detail (live price, Buy, bought/remove), Bought history · **Goals**: by horizon / by category, New goal, goal detail (hours of work, progress, contributions, achieve), income, vision board, achieved wall · Notifications · Settings (sessions, notifications, privacy, app lock, export, delete).

---

## 14. Dashboard and metrics

`GET /dashboard` returns two separate objects. The app shows them as two cards; there is no combined total.

| Field | Definition |
|---|---|
| `cart.totalPaise`, `cart.count` | §8.2 Cart total |
| `cart.byStore` | top stores: `[{ storeKey, name, logoUrl, count, totalPaise }]` |
| `cart.bought` | `{ thisMonthPaise, thisYearPaise, count }` |
| `cart.cheaperElsewhereCount` | V2 (Phase 7) |
| `cart.recent` | 5 newest active cart items (card view) |
| `goals.totalPaise`, `goals.count` | §8.2 Goals total, plus `byHorizon` |
| `goals.savedPaise` | Σ active `savedPaise` |
| `goals.achieved` | `{ allTimePaise, thisYearPaise, count }` |
| `goals.nextMilestone` | §8.4: `{ goalId, title, remainingPaise, progress }` or null |
| `goals.hoursOfWork` | total remaining goal cost as hours/days/months/years, or null |
| `monthSummary` | `{ cart: { added, bought }, goals: { contributedPaise, achieved } }` for the current month |

All metrics are computed in `modules/dashboard/metrics.ts` (separate `cartMetrics()` and `goalMetrics()` functions) and reused by the monthly summary; the app never recomputes them. Cached in Redis per user for 60 s and invalidated on any cart, goal, income or contribution write.

---

## 15. Testing strategy and seed data

### 15.1 Server tests (Vitest + Supertest + MongoMemoryReplSet)
- Each test file gets its own in-memory replica set (`tests/setup.ts`); Redis is replaced with `ioredis-mock` for unit/integration tests; BullMQ jobs are tested by calling `runX()` directly.
- `tests/helpers/`: `testApp` (mount test-only routes), `expectErrorShape`, `loginAs(user)` (Phase 1), fixtures (`createUser`, `createProduct`, `createItem`…), `mockstores` (starts the fixture server on a random port).
- Every new endpoint: success, validation failure, unauthenticated (401), other user's record (404), and limits.
- `routeInventory.test.ts` (Phase 1): every mounted route needs `authenticate` unless listed in `PUBLIC`.

### 15.2 Mobile tests
jest-expo + React Native Testing Library for components and screens (RTK Query mocked with a fake base query or MSW). Maestro flows in `mobile/e2e/` for journeys (`npm run e2e:mobile`).

### 15.3 Smoke tests — `npm run smoke`
Runs against a running API with the seed loaded (starts a temporary server on a free port if none is running; never stops a server it did not start). Grows every phase: health (0) → logins for all seed users, sessions, 401/404 checks (1) → stores, extract on mockstores (2) → cart, store groups, cart golden totals (3) → goals, contributions, hours of work, dashboard (4) → notifications, export (5) → admin (6) → comparison (7)… Writes are undone at the end.

### 15.4 mockstores
`mockstores/` serves saved HTML from `mockstores/stores/<store>/*.html` (plus delayed and broken routes for timeout/failure tests and search pages for V2). In dev/test `MOCKSTORES_URL` rewrites store hosts to it. Tests never call real stores.

### 15.5 Seed data (`npm run seed`, `--reset`)
Idempotent upserts through the services, fixed ids and values. Refuses to run when `NODE_ENV=production`.
| Data | Contents |
|---|---|
| Stores | the 10 MVP stores + `unknown` |
| Categories | 7 cart + 7 goal built-ins |
| Admin | `admin@allinone.test`, password `Password@123`, fixed TOTP secret printed by the seed (dev only) |
| Asha | `+910000000001` (OTP `000000`), 176 h/month, income ₹1,00,000/month for the last 3 months. **Cart:** 9 items across Myntra, Amazon, Zara, H&M, Bear House and Flipkart (incl. AirPods), 1 bought, 1 removed, 1 custom cart category. **Goals:** "Porsche 911" (life), "3BHK apartment" (life), "BMW M340i" (big), "Bali trip" (this year), "MacBook Pro" (this year); contributions toward 2 goals; 1 achieved goal and 1 dropped goal |
| Ravi | `+910000000002`: no income; 2 cart items and 1 goal (hours of work must be null) |
| Products | built from the mockstores fixture pages |

`server/src/seed/expectations.json` holds the **golden numbers**, computed by hand, in two separate blocks: `cart` (Asha's total, count, per store, per category, bought) and `goals` (total per horizon and category, saved, achieved, next milestone, hours of work for 3 named goals and the total). Smoke tests and seed tests assert them exactly; the file changes only when the seed is changed on purpose.

---

## 16. Error code catalogue
| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod / Mongoose validation; `details: [{ field, message }]` |
| `BAD_REQUEST` | 400 | malformed JSON, bad id |
| `UNAUTHORIZED` | 401 | missing / invalid / expired access token |
| `OTP_INVALID` | 401 | wrong code (`details.attemptsLeft`) |
| `OTP_EXPIRED` | 401 | no active challenge |
| `REFRESH_INVALID` | 401 | unknown, expired or reused refresh token |
| `ACCOUNT_INACTIVE` | 401 | blocked or deletion pending |
| `FORBIDDEN` | 403 | role not allowed |
| `NOT_FOUND` | 404 | missing or not yours |
| `CONFLICT` | 409 | duplicate key, version conflict |
| `DUPLICATE_ITEM` | 409 | same Product already in the active cart (§8.7) |
| `INVALID_STATUS_TRANSITION` | 409 | §5 |
| `RECORD_LOCKED` | 409 | write to an append-only record |
| `PAYLOAD_TOO_LARGE` | 413 | body > 1 MB |
| `FILE_TOO_LARGE` | 413 | upload over limit |
| `UNSUPPORTED_FILE_TYPE` | 415 | magic-byte check failed |
| `BUSINESS_RULE_VIOLATION` | 422 | generic rule failure |
| `EXTRACT_FAILED` | 422 | page could not be read (`details.url`) |
| `STORE_UNSUPPORTED` | 422 | not a web page / blocked host |
| `ITEM_LIMIT_REACHED` | 422 | §8.8 (`details.section`) |
| `RATE_LIMITED` | 429 | any limiter (`details.retryAfterSeconds`) |
| `INTERNAL_ERROR` | 500 | unexpected (message hidden in production) |
| `SERVICE_UNAVAILABLE` | 503 | DB/Redis down, upstream unavailable |
| `UPSTREAM_TIMEOUT` | 504 | store fetch timed out outside `/extract` |

New codes are added here, to `ERROR_CODES` and to `ERROR_HTTP_STATUS` together.

---

## 17. Non-functional requirements
- API p95 < 300 ms for reads with 100× the seed; `/extract` answers within 3.5 s (partial on timeout).
- Mobile: cold start < 2.5 s on a mid-range Android; crash-free sessions ≥ 99.5 %; Cart and Goals lists scroll at 60 fps with 500 entries (FlashList).
- Availability target 99.5 % for the API.
- Accessibility per §13.3. Works from 360 pt wide.
- Test coverage ≥ 80 % lines on server services, policies and utils (Phase 6 gate).
- All secrets from env; no secret in the app bundle except public keys (`EXPO_PUBLIC_*`).

---

## 18. Environments and deployment
| Environment | Setup |
|---|---|
| Local | `docker compose up`: MongoDB 8 single-node replica set, Redis 7, MinIO, mockstores. API + worker via `npm run dev`; app via Expo dev build on a phone or simulator |
| Test / CI | GitHub Actions: lint, typecheck, server tests (in-memory Mongo, mocked Redis), mobile tests, smoke against a compose stack |
| Staging | API + worker on Render or Railway (or AWS in ap-south-1); MongoDB Atlas (Mumbai); Upstash Redis; Cloudflare R2; EAS internal builds; Sentry |
| Production | Same as staging with separate projects and secrets; EAS Submit to App Store and Play Store; OTA updates via EAS Update for JS-only fixes |

Deploys: merge to `main` → staging (migrations/index builds, smoke against staging) → manual approval → production. Mobile releases follow app store review.

---

## 19. Build phases mapped to this spec
| Phase | Name | Spec |
|---|---|---|
| 0 | Project setup | §3, §7.1–7.2, §15.3–15.4, §16, §18 (local) |
| 1 | Authentication and accounts | §2, §5.5, §6.3–6.5, §6.14, §7.3–7.4, §11.1, §11.4, §11.6, §13.1–13.2 |
| 2 | Stores, categories and extraction | §6.6–6.8, §6.15, §7.5–7.6, §8.5–8.6, §8.11, §9, §11.3 |
| 3 | Cart | §4.1–4.2, §4.4, §4.7, §5.1 (cart), §6.9 (cart_items), §7.7, §8.1–8.2, §8.6–8.8, §13 |
| 4 | Goals and motivation | §4.3, §4.5–4.6, §4.8–4.9, §5.1 (goal), §6.9 (goals), §6.10–6.11, §7.7a, §7.8, §8.2–8.5, §14 |
| 5 | Notifications, privacy and settings | §4.9, §6.12–6.13, §7.9, §11.2, §11.5, §12 |
| 6 | Admin, hardening and MVP release | §2.3, §7.10, §15, §17, §18 |
| 7 | Exact-match price comparison (V2) | §4.10, §5.2–5.3, §6.16, §7.11, §10 |
| 8 | Price tracking and alerts (V2) | §5.4, §10.5, §12 |
| 9 | Affiliate links and Premium (V2) | §8.8, §7.12 |
| 10 | Motivation V2, lists, sharing and AI (V2) | §8.9, §7.12 |
| 11 | More platforms (V2) | §9.1, §11.2 |

---

## 20. Open decisions
| # | Question | Default until decided |
|---|---|---|
| O1 | Brand name | "ALLinONEcart" |
| O2 | SMS provider (MSG91 vs Twilio) | `console` transport in dev |
| O3 | Hosting (Render vs Railway vs AWS) | decide in Phase 6 |
| O4 | Does comparison move into the MVP (Amazon + Flipkart only)? | No – Phase 7 |
| O5 | Premium price and free limits | 50 cart items, 20 goals |
| O6 | Cooling-off threshold | ₹5,000 |
| O7 | Similar-match suggestions | Parked until the product owner asks |

### Decisions made
| # | Date | Decision |
|---|---|---|
| D1 | 2026-10-24 | Stack: Express 4 + Mongoose 8 + TypeScript (server), Expo + Expo Router (mobile), npm workspaces. Replaces PostgreSQL from the first documentation draft. |
| D2 | 2026-10-24 | Jobs on BullMQ + Redis (per-store rate limits), not node-cron. |
| D3 | 2026-10-24 | Push through Expo Push Service instead of direct FCM/APNs. |
| D4 | 2026-10-24 | Comparison is exact-match only; similar matches parked. |
| D5 | 2026-10-24 | Admins cannot read users' income, contributions or item text (aggregates only). |
| D6 | 2026-10-25 | **Cart and Goals are two fully separate sections**: separate collections (`cart_items`, `goals`), modules, endpoints, screens, categories, status machines and totals. Items never move between them and their totals are never added together. Savings, hours of work, vision board and achieved wall are Goals-only; store grouping, live prices, Buy, comparison and price alerts are Cart-only. Goals may store an optional reference link that is never fetched. |
| D7 | 2026-10-25 | **mockstores runs as a Node workspace process, not a Docker Compose service** (§18 local row). `npm run dev` starts it on port 4010 and tests start it on a random port with `startMockstores({ port: 0 })`. Docker Compose holds MongoDB, Redis and MinIO only. |
| D8 | 2026-10-25 | **Phase 0 health screen is the temporary home** (`app/index.tsx`) rather than `app/dev/health.tsx` (§13.1). The `HealthCard` moves to `dev/health.tsx` (dev builds only) when Home becomes the dashboard in Phase 4. |
| D9 | 2026-10-25 | **Mobile-only error codes.** The app's error normaliser produces `NETWORK_ERROR` and `TIMEOUT` (status 0), `BAD_RESPONSE` (non-JSON reply), `HTTP_ERROR` (non-standard error body) and `UNKNOWN`. The API never returns them, so they are not part of §16. |
