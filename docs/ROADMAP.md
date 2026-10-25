# ALLinONEcart – Build Roadmap

Phase-by-phase plan for building ALLinONEcart. Details for every item are in `docs/PROJECT_SPEC.md` (section numbers in brackets).

**How to use this file**
- Work on one phase at a time, in order. Each phase ends with something working that you can demo on your phone.
- Tick items (`[x]`) as they are finished and add short notes under "Notes / decisions".
- At the end of each phase: all tests pass, lint and typecheck are clean, `npm run smoke` passes on a fresh seed, the README is updated, and there is a Git commit.
- Phases 0–6 are the **MVP**. Phases 7–11 are **V2** and start only after the MVP gate.

## Progress overview

| Phase | Name | Status |
|---|---|---|
| 0 | Project setup | ✅ Done |
| 1 | Authentication and accounts | 🟡 In progress |
| 2 | Stores, categories and product extraction | ⬜ Not started |
| 3 | Cart | ⬜ Not started |
| 4 | Goals and motivation | ⬜ Not started |
| 5 | Notifications, privacy and settings | ⬜ Not started |
| 6 | Admin, hardening and MVP release | ⬜ Not started |
| — | **MVP gate** (40 % activation, 25 % day-30 retention) | ⬜ |
| 7 | Exact-match price comparison | ⬜ Not started |
| 8 | Price tracking and alerts | ⬜ Not started |
| 9 | Affiliate links and Premium | ⬜ Not started |
| 10 | Motivation V2, lists, sharing and AI | ⬜ Not started |
| 11 | More platforms | ⬜ Not started |

Status key: ⬜ Not started · 🟡 In progress · ✅ Done

---

## Phase 0 – Project setup
**Goal:** a clean monorepo with local services, the shared backend building blocks and an Expo app that shows the API status.
**Spec:** §3, §7.1–7.2, §15.3–15.4, §16, §18 (local)

- [x] npm workspaces monorepo: `server/`, `mobile/`, `shared/` (+ `mockstores/` placeholder)
- [x] TypeScript strict everywhere; ESLint (flat config) + Prettier + `.editorconfig` + `.gitignore`
- [x] `docker-compose.yml`: MongoDB 8 single-node replica set, Redis 7, MinIO (mockstores runs via `npm run dev` instead – D7)
- [x] Env config validated with Zod; `server/.env.example`, `mobile/.env.example`
- [x] Pino logger with redaction + request ids; `serializeError()`
- [x] `ApiError`, `sendSuccess`, `asyncHandler`, pagination helpers, `ERROR_CODES` + `ERROR_HTTP_STATUS`
- [x] `validate()` middleware (Zod)
- [x] Central error handler + 404 handler (standard error format)
- [x] Helmet, CORS allow-list, compression, rate limiter
- [x] MongoDB + Redis connections, graceful shutdown; empty worker entry point (`worker.ts`)
- [x] `GET /api/v1/health` (db + redis status)
- [x] `shared/` package with the first enums (cart statuses, goal statuses, goal horizons, priority) and `STATE_MACHINES.cartItem` / `.goal`
- [x] Mobile: Expo + Expo Router + NativeWind + RTK Query; dev health screen showing API/DB/Redis status (on the temporary home – D8)
- [x] Tests: health, 404, validation, error handler, malformed JSON, request id, logging (no bodies); one mobile component test
- [x] `npm run smoke` (health check) and `npm run seed` skeleton (idempotent, empty)
- [x] GitHub Actions CI: lint, typecheck, tests
- [x] README + first Git commit

**Done when:** `docker compose up` + `npm run dev` start everything; the Expo app on your phone shows "API: ok · DB: connected · Redis: connected"; `npm test`, `npm run lint`, `npm run typecheck` and `npm run smoke` pass.

**Verification (2026-10-25):** `npm run lint`, `format:check`, `typecheck`, `npm test` (shared 32 · server 60 · mobile 23), `npm run seed` (twice and `-- --reset`), `npm run smoke` (with an API running and without) and a server start with `MONGO_URI` unset (exits 1 naming the variable) all pass. `npm run services:up` + `npm run dev` start everything; the API and Metro answer on the LAN IP and Metro bundles the app for iOS and Android.
- [ ] Confirm on a physical phone (Expo Go) that the app shows "API: ok · DB: connected · Redis: connected" – not checked from the build machine (no simulator installed)
- [ ] First CI run green on GitHub (no remote pushed yet)

**Notes / decisions:**
- Versions: Expo SDK 58 (React Native 0.88, React 19.3), TypeScript 6.0 (typescript-eslint supports < 6.1), ESLint 9 (eslint-plugin-react / -import don't support 10), NativeWind 4.2 + Tailwind 3.4 (v5 is an RC), Zod 4, Express 4.22, Mongoose 8, Vitest 5, React Native Testing Library 14.
- ioredis pinned to v5: ioredis-mock only supports 5 (BullMQ 6 accepts ≥ 5). ioredis-mock can't run BullMQ's Lua scripts – job tests call `runX()` directly (§15.1).
- TypeScript 6: `types` defaults to `[]` (list them explicitly, e.g. `"types": ["jest"]` in mobile); side-effect imports are checked (`mobile/css.d.ts` declares `*.css`).
- RNTL 14: `render` and `fireEvent` are async – always `await` them.
- Docker: MongoDB is on host port **27018** (a Homebrew MongoDB holds 27017); `MONGO_URI` in `server/.env.example` uses it. Host ports and MinIO credentials can be overridden in a root `.env`.
- MinIO images come from `cgr.dev/chainguard/minio` and `minio-client` (`minio/minio` is no longer on Docker Hub; only `:latest` is free).
- `minio-init` is in the compose `setup` profile because `docker compose up --wait` fails on exited one-shot containers; `npm run services:up` runs it after the services are healthy. A plain `docker compose up` does not create the bucket.
- `PORT` defaults to 5001 (not 5000) so an unset PORT never hits AirPlay.
- Logging: `*.code` is not redacted (it would hide error codes); `otp` / `otpCode` are, and bodies are never logged. `serializeError()` removes values that Mongo/Mongoose put into duplicate-key, cast and validation messages.
- Redis down at startup is not fatal (the API starts, `/health` shows `redis: disconnected`, ioredis reconnects); MongoDB down at startup is fatal.
- The global rate limiter uses the in-memory store for now; switch to a Redis store before running more than one API instance.
- `npm test` runs shared → server → mobile. `npm run dev` runs Expo without a terminal, so it prints no QR code: use `exp://<LAN-IP>:8081` or `npm run dev:backend` + `npm run dev:mobile` in two terminals.
- `shared/` builds incrementally (`dist/.tsbuildinfo`) so rebuilding it (pre-hooks of test/typecheck/seed/smoke) doesn't restart the dev API under `tsx watch`.
- Spec divergences recorded in §20: D7 (mockstores not in Docker Compose), D8 (Phase 0 health card on the temporary home), D9 (mobile-only error codes).
- npm 11 install-script approvals (`allowScripts`): esbuild, fsevents, unrs-resolver. `msgpackr-extract` (optional speed-up) and `mongodb-memory-server` (binary downloads on first use) are left unapproved.
- `npm audit` reports 5 high issues inside `@expo/cli` (node-forge, an old zod) – dev tooling only, not in the app bundle. Don't run `npm audit fix --force` (it downgrades Expo to SDK 44).

---

## Phase 1 – Authentication and accounts
**Goal:** phone OTP and Google/Apple sign-in, secure sessions, profile, and an append-only audit log.
**Spec:** §2, §5.5, §6.3–6.5, §6.14, §7.3–7.4, §11.1, §11.4, §11.6, §13.1–13.2

- [ ] User, Session and OtpChallenge models
- [ ] SMS service (`console` + one real transport) and test-number rule (`ALLOW_TEST_OTP`)
- [ ] OTP request / verify with limits and lockout
- [ ] Google and Apple ID-token sign-in
- [ ] JWT access tokens; refresh rotation with reuse detection; logout, logout-all, session list/revoke
- [ ] `authenticate` and `authorize(...roles)` middleware; account status checks
- [ ] Ownership policy helpers (`ownedFilter(user)`, `assertOwned` → 404)
- [ ] `GET/PATCH /me`
- [ ] Audit service + AuditLog model (append-only hooks, hash chain)
- [ ] Admin user type with email + password + TOTP login (API only; panel in Phase 6)
- [ ] Rate limits on OTP and login
- [ ] Mobile: phone and OTP screens, Google/Apple buttons, SecureStore refresh token, RTK Query base query with refresh mutex, auth guard, tabs skeleton, profile screen with sessions and logout
- [ ] Seed: Asha, Ravi, admin
- [ ] Tests: OTP flows and limits, refresh reuse, ownership 404s, route inventory, audit immutability, no secrets in responses or logs
- [ ] Smoke: all seed logins, `/me`, 401 without token

**Done when:** Asha and Ravi sign in on the phone with OTP `000000`, restart the app and stay signed in, see their sessions and log out; the admin can log in through the API.

**Notes / decisions:**

---

## Phase 2 – Stores, categories and product extraction
**Goal:** a URL from any of the 10 MVP stores becomes a clean product preview, without ever calling real stores in tests.
**Spec:** §6.6–6.8, §6.15, §7.5–7.6, §8.5–8.6, §8.11, §9, §11.3

- [ ] Store and Category models (with `section`); seed the 10 MVP stores and the 7 cart + 7 goal built-in categories; `GET /stores`, categories CRUD
- [ ] Product model (shared, unique `store + canonicalUrl`)
- [ ] Storage adapter (MinIO / R2) and BullMQ queues in the worker
- [ ] `cache_images` job (stored copy + WebP thumbnail)
- [ ] Safe fetcher (SSRF protection, size and time limits) + Playwright option
- [ ] URL normalisation with tracking-parameter removal
- [ ] Adapter interface + generic parser (JSON-LD → Open Graph → meta)
- [ ] mockstores server with ≥ 2 fixture pages per store, plus slow and broken routes
- [ ] 10 store adapters with fixture tests
- [ ] `POST /extract` (cache, 3 s budget, partial preview, `extract_product` retry, `EXTRACT_FAILED`)
- [ ] Rule-based cart category suggestions
- [ ] Extraction logs + `parser_health` job; `npm run adapters:live` (manual)
- [ ] Tests: normalisation, parser per fixture, adapters, extract endpoint, SSRF, jobs
- [ ] Smoke: extract a fixture URL from every store

**Done when:** `/extract` returns a correct preview for every store's fixtures; `npm run adapters:live` shows which real store pages work today.

**Notes / decisions:**

---

## Phase 3 – Cart
**Goal:** share products from any store app into the Cart and see every store's cart in one place, with correct totals.
**Spec:** §4.1–4.2, §4.4, §4.7, §5.1 (cart), §6.9 (`cart_items`), §7.7, §8.1–8.2, §8.6–8.8, §13

- [ ] CartItem model + cart status machine (`assertTransition`, conditional updates, `statusHistory`)
- [ ] `POST /cart` (from a URL or productId), duplicates (`DUPLICATE_ITEM`), limits, `activeCartCount` on Products
- [ ] `GET /cart` (filters, sort, cursor, totals), `GET /cart/groups?by=store|category`, `GET/PATCH/DELETE /cart/:id`
- [ ] Bought / unbuy / remove / restore actions; `GET /cart/bought`; `GET /cart/:id/buy-link`
- [ ] Mobile: UI kit, onboarding (profile, stores, income, share tutorial)
- [ ] Mobile: share intent → Add-to-Cart sheet (preview, variant pickers, category, priority, manual fallback), paste link + clipboard prompt
- [ ] Mobile: Cart tab (by store – one section per store cart – and by category; search, filters, sort, grid/list), cart item detail, edit, Buy flow with "Did you buy it?", Bought history
- [ ] Seed: Asha's and Ravi's cart items + `expectations.json` → `cart` golden numbers
- [ ] Tests: cart API (owner, other user 404, validation), cart status machine, groups and totals vs golden numbers; Maestro: add to cart via share, browse by store, buy
- [ ] Smoke: cart list, store groups and totals equal the golden numbers

**Done when:** on your phone you can share 3 real products from different store apps, see them under their own store carts with correct totals, and mark one as bought.

**Notes / decisions:**

---

## Phase 4 – Goals and motivation
**Goal:** a separate Goals section for big targets (house, car, trip) with savings, hours of work, vision board and achieved wall, plus a Home screen with separate Cart and Goals cards.
**Spec:** §4.3, §4.5–4.6, §4.8–4.9, §5.1 (goal), §6.9 (`goals`), §6.10–6.11, §7.5 (uploads), §7.7a, §7.8, §8.2–8.5, §14

- [ ] Goal model + goal status machine; goal categories (section `goal`)
- [ ] Uploads (signed URLs, magic-byte check) for goal and achieved photos
- [ ] `POST/GET/PATCH/DELETE /goals`, `GET /goals/groups?by=horizon|category`, achieve / unachieve / drop / restore
- [ ] Horizon and goal-category suggestions; optional reference link (never fetched)
- [ ] IncomeEntry and Contribution models; contributions update the goal's `savedPaise` and status in one transaction
- [ ] `utils/hoursOfWork.ts` with unit tests (all display ranges, no income)
- [ ] Dashboard metrics module (`cartMetrics`, `goalMetrics`) + `GET /dashboard` (Redis cache + invalidation) – never a combined total
- [ ] `GET /goals/vision-board`, `GET /goals/achieved`
- [ ] Mobile: Goals tab (by horizon / by category), New goal, goal detail, edit, add savings + progress, hours of work, income screen, first-goal onboarding step
- [ ] Mobile: Home with a Cart card and a Goals card, vision board, achieve flow with celebration, achieved wall
- [ ] Seed: Asha's and Ravi's goals, income and contributions + `expectations.json` → `goals` golden numbers
- [ ] Tests: goals API, goal status machine, contributions transaction, metrics vs golden numbers, Cart and Goals never mixed; Maestro: create goal → log income → add savings → achieve
- [ ] Smoke: goals totals and dashboard equal the golden numbers; Ravi's hours of work is null

**Done when:** Asha's Goals tab and Home cards on the phone match `expectations.json`, adding savings or achieving a goal updates them immediately, and nothing from the Cart appears in Goals (or the reverse).

**Notes / decisions:**

---

## Phase 5 – Notifications, privacy and settings
**Goal:** push notifications with sensible limits, and the privacy features users expect before launch.
**Spec:** §4.9, §6.12–6.13, §7.9, §11.2, §11.5, §12

- [ ] Device model + Expo push service (`send_push`, receipts, `DeviceNotRegistered`)
- [ ] Notification service: in-app record, `dedupeKey`, 3/day limit, quiet hours, per-type switches
- [ ] `monthly_checkin` and `milestone_ready` notifications
- [ ] Notifications inbox + unread count
- [ ] Field-level encryption for income and contribution amounts (with a migration)
- [ ] Export (JSON/CSV) and account deletion (`deletion_pending` → purge job)
- [ ] Consent screens (terms, privacy version, analytics opt-in) and grievance contact
- [ ] Mobile: notification permission flow, inbox, settings (notifications, quiet hours, privacy, app lock with biometrics, export, delete)
- [ ] Tests: notification limits/quiet hours/dedupe with a fixed clock, encryption at rest, export contents, deletion purge, other users untouched
- [ ] Smoke: notifications inbox, export for Asha

**Done when:** you receive the monthly check-in push on your phone, the app locks with Face ID / fingerprint, and export and deletion work.

**Notes / decisions:**

---

## Phase 6 – Admin, hardening and MVP release
**Goal:** an admin panel, analytics, a full test and security pass, and the app in the stores.
**Spec:** §2.3, §7.10, §15, §17, §18

- [ ] `admin/` workspace: React + Vite + Tailwind; login with TOTP; stores, parser health, extraction logs, users (basic), audit log with chain verify, metrics
- [ ] PostHog analytics with the allow-listed events (no titles, prices, income, URLs)
- [ ] Sentry on server, worker and mobile
- [ ] Coverage ≥ 80 % on services, policies and utils; full Maestro journey
- [ ] Performance check with 100× seed (p95 < 300 ms)
- [ ] Security review against §11 (route inventory, ownership sweep, logs, SSRF, uploads)
- [ ] Accessibility pass (labels, dynamic type, contrast, 360 pt)
- [ ] Staging + production: Atlas, Upstash, R2, API + worker hosting, EAS builds, deploy pipeline with smoke against staging
- [ ] Closed beta (50–100 users), fixes, store listings, App Store + Play Store submission

**Done when:** the app is live in both stores and the staging smoke run passes on every deploy.

**Notes / decisions:**

---

## MVP gate
Start Phase 7 only when, over the first months after launch:
- [ ] 40 % of new users add 3+ cart items or goals in their first week
- [ ] 25 % of users are active 30 days after sign-up

---

## Phase 7 – Exact-match price comparison
**Goal:** for every cart item, show where the exact same product is cheaper.
**Spec:** §4.10, §5.2–5.3, §6.16, §7.11, §10

- [ ] MatchGroup and MatchReport models; `comparison` on cart items
- [ ] Fingerprint builder + normalisation rules + labelled match set (precision ≥ 99 % in CI)
- [ ] Amazon PA-API and Flipkart Affiliate API clients; `search()` in comparison-store adapters
- [ ] `find_exact_matches` job; `GET /cart/:id/offers`, refresh, switch store
- [ ] Median outlier hiding; "Only sold on" state
- [ ] Wrong-match reports + admin review queue
- [ ] Mobile: comparison section on cart items, "Cheaper on N stores" badge, switch store, report
- [ ] Seed: iPhone 18 on Apple / Croma / Flipkart / Amazon fixtures (+ refurbished and 128 GB non-matches) with golden results
- [ ] Smoke: comparison for the seeded iPhone equals the golden result

**Done when:** saving the seeded iPhone shows Croma ₹1,30,000 lowest, then Apple and Flipkart ₹1,40,000, then Amazon ₹1,60,000, and never the refurbished or 128 GB listing.

**Notes / decisions:**

---

## Phase 8 – Price tracking and alerts
**Goal:** prices stay fresh and users hear about drops and restocks.
**Spec:** §5.4, §10.5, §12

- [ ] PriceHistory; `nextCheckAt` scheduler with per-store limits; `refresh_price`
- [ ] Cart alerts (price below, back in stock, cheaper elsewhere) and goal target-date reminders + `evaluate_alerts`
- [ ] Price history chart; sale calendar
- [ ] Notifications: `comparison_ready`, `price_drop`, `back_in_stock`, `target_date`
- [ ] Tests with a fake clock and changeable mockstores prices

**Done when:** changing a mockstores price triggers exactly one alert at the right time.

**Notes / decisions:**

---

## Phase 9 – Affiliate links and Premium
**Goal:** revenue from Buy clicks and an optional Premium plan.
**Spec:** §8.8, §7.12

- [ ] Affiliate config per store, `affiliateUrl()`, `GET /go/:productId` with click records
- [ ] Affiliate disclosure in the app
- [ ] Premium via in-app subscriptions (RevenueCat), plan limits, upgrade screen
- [ ] Admin: affiliate click report

**Done when:** every Buy button carries the affiliate tag and the free limit is enforced.

**Notes / decisions:**

---

## Phase 10 – Motivation V2, lists, sharing and AI
**Goal:** deeper motivation and social features.

- [ ] Goals: income vs. goals chart, projections, savings plan calculator, EMI view, split savings
- [ ] Cart: monthly spending limit, cooling-off and "Still want this?" jobs
- [ ] Streaks, badges, daily motivation notification, vision board wallpaper export
- [ ] Lists, tags, drag to reorder; shared lists and gift lists (Cart)
- [ ] Share a cart item, a goal or the vision board as an image
- [ ] AI cart-category and goal-horizon suggestions, goal price estimates, monthly insights

**Notes / decisions:**

---

## Phase 11 – More platforms
- [ ] Home-screen widgets (iOS and Android)
- [ ] User web app
- [ ] Chrome extension with a Save-to-Cart button
- [ ] Hide-amounts mode, backup and restore

**Notes / decisions:**

---

## Backlog (later)
Effective price with bank offers, coupons, comparison history and savings counter, yearly recap, goal planning chat, inflation adjustment, savings/investment account linking, accountability partner, scan in store, voice add, multiple currencies and markets, partner product feeds, smartwatch glance.

## Parked
| Feature | Status |
|---|---|
| Similar-match suggestions | Do not build until the product owner asks |
| Email parsing of order/cart emails | Revisit after launch |
| In-app checkout | Not planned |
