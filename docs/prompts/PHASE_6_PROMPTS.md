# ALLinONEcart – Phase 6 prompts: Admin, hardening and MVP release

**Goal:** an admin panel, analytics and error monitoring, a full test, performance, accessibility and security pass, production infrastructure, and the app in both stores.
**Spec:** §2.3, §7.10, §11, §15, §17, §18

Start a fresh session (`/clear`). This phase adds no new user features. If something seems to need one, ask first.

---

## Prompt 1: Read and plan (no code)

```
We are starting Phase 6 of ALLinONEcart: admin, hardening and the MVP release.

Read these first:
- CLAUDE.md (all building blocks)
- docs/ROADMAP.md (Phase 6)
- docs/PROJECT_SPEC.md §2.3, §7.10, §11, §15, §17, §18

Do NOT write code yet. Give me:
1. The admin API endpoints and the admin/ workspace structure (pages, auth flow with TOTP, token storage for a web app – access token in memory, refresh token in an HttpOnly cookie on the admin routes only, or another design you justify).
2. Analytics events (name, properties) – every property must be an id, enum or count; no titles, prices, income, URLs.
3. The hardening plan: coverage targets and gaps you expect, the 100× seed performance test, accessibility checks, security review checklist.
4. The hosting plan for staging and production (API + worker, MongoDB Atlas Mumbai, Upstash Redis, Cloudflare R2, Sentry, PostHog, EAS), with costs at the free/starter tiers and what I must sign up for.
5. The release plan: EAS build profiles, app store listings, privacy labels / data safety answers, beta testing (TestFlight + Play internal testing).
6. Build order matching the next prompts, and anything unclear.

Wait for my approval before building.
```

---

## Prompt 2: Admin API

```
Build step 1 of Phase 6. Server. Spec §2.3, §7.10.

1. All /admin routes: authenticate + authorize('admin'). Admin views never include users' income, contributions, cart item or goal titles, notes or why (serializers + a test that sweeps every admin response for those keys).
2. Endpoints:
   - GET /admin/stores, PATCH /admin/stores/:id (isActive, needsBrowser, rateLimitPerMinute, logoUrl, domains) – audit admin.store_update
   - GET /admin/parser-health (latest parser_health results + 7-day history per store)
   - GET /admin/extraction-logs (filters: store, ok, reason, date range; page pagination)
   - GET /admin/products (search by store/title, page pagination) and POST /admin/products/:id/hide (excluded from new saves; audit admin.product_hide)
   - GET /admin/users (id, created, last login, status, cart item count, goal count – no titles, no money), POST /admin/users/:id/block | unblock | logout-all (audited; block revokes sessions)
   - GET /admin/audit-logs (filters: action prefix, actor, target, date; page pagination), GET /admin/audit-logs/verify
   - GET /admin/metrics: signups per day, DAU/WAU/MAU (from lastLoginAt/sessions), cart items added per day by channel, goals created per day, extraction success rate, activation (new users with 3+ cart items or goals in 7 days), day-30 retention – computed in modules/admin/metrics.ts
3. Admin access: an admin can't use the user endpoints (403), a user can't use /admin (403).
4. Tests: RBAC for every admin route (user → 403, admin → 200, no token → 401), privacy sweep of admin responses, block/unblock effects, metrics against a small fixed dataset.
5. Smoke (phase6.ts): admin login with TOTP, parser health, users list contains Asha with no money fields, audit verify ok.

Run lint, typecheck, tests, smoke. Commit: "feat(admin): add admin api".
```

---

## Prompt 3: Admin panel (web)

```
Build step 2 of Phase 6: the admin/ workspace.

1. admin/: React 18 + Vite + TypeScript + Tailwind v4 (@tailwindcss/vite) + Redux Toolkit/RTK Query + React Router v6. Add to root scripts (dev:admin, build:admin, test:admin with Vitest + React Testing Library + MSW) and to CLIENT_URLS.
2. Auth: login page (email, password, TOTP), tokens per the approved design, auto-refresh, logout, idle timeout 30 min.
3. Pages: Overview (metrics cards and simple charts), Stores (table, edit drawer, parser health badge), Parser health (per store success rate, 7-day trend, recent failures with reasons), Extraction logs, Products (search, hide), Users (list, block/unblock, logout-all with confirm), Audit log (filters, expandable rows, chain verify button).
4. Every page: loading, empty and error states; works at 1024 px and up (admin is desktop-first).
5. Tests: login flow, each page renders MSW data, destructive actions confirm.

Run lint, typecheck, tests and build. Then run it locally against the seeded API and tell me the URL. Commit: "feat(admin): add admin panel".
```

**Check after**
- [ ] Log in to the admin panel with the seeded admin and the TOTP from your authenticator app
- [ ] Parser health shows every store; blocking Ravi signs him out on the phone

---

## Prompt 4: Analytics and error monitoring

```
Build step 3 of Phase 6. Spec §11.5–11.6, §17.

1. Sentry: server and worker (SENTRY_DSN; scrub request bodies, query strings, headers with tokens; release = git sha), mobile (sentry-expo / @sentry/react-native with source maps through EAS), admin panel. Test that a thrown error in a test route reaches a fake transport with no body.
2. PostHog: mobile only, and only when the user's analytics consent is on. A typed track(event, props) wrapper whose props type allows only ids, enums, counts and booleans. Events (Cart and Goals named separately): app_opened, signup_completed, onboarding_completed, cart_item_added (channel, storeKey), extract_failed (storeKey, reason), cart_item_viewed, buy_clicked (storeKey), cart_item_bought, cart_item_removed, goal_created (horizon), goal_viewed, contribution_added, income_logged, goal_achieved, goal_dropped, vision_board_opened, notification_opened (type). A unit test fails if a property name looks like title|price|amount|income|url|note.
3. Activation and retention dashboards: write docs/ANALYTICS.md with how to build them in PostHog (funnels, retention) – these measure the MVP gate.

Run lint, typecheck, tests. Commit: "feat: add sentry and consent-based analytics".
```

---

## Prompt 5: Hardening – tests, performance, accessibility

```
Build step 4 of Phase 6. Spec §15, §17, §13.3.

1. Coverage: npm run test:coverage; server must reach ≥ 80 % lines on services, policies and utils (fail below). Add tests for the gaps; report before/after.
2. Full Maestro journey mobile/e2e/100_full_journey.yaml: sign up with a new test number → onboarding (with first goal) → share a product to the Cart (deep link) → see it in its store cart → buy it → create a goal with a photo → log income → add savings → achieve → achieved wall → Home shows separate Cart and Goals cards → notification inbox → export → logout.
3. Performance: npm run seed:large (100× Asha's cart items and goals across 200 users, through fast bulk inserts that respect the schemas), then a script that measures p50/p95 for GET /cart, /cart/groups, /goals, /goals/groups, /dashboard, /goals/achieved with Asha; target p95 < 300 ms locally. Use explain() to check indexes; fix slow queries. Report the numbers.
4. Mobile performance: Cart and Goals lists with 500 entries scroll smoothly (FlashList estimatedItemSize, memoised cards, expo-image caching); cold start measured on a release build.
5. Accessibility pass: every touchable has a label and role; dynamic type at 200 % doesn't cut text on Home, Cart, cart item detail, Add-to-Cart sheet, Goals, goal detail; contrast of tokens ≥ 4.5:1 for text (write a small token contrast test); reduce motion respected. List what you fixed.
6. Offline: Cart, Goals and Home show cached data with an "Offline" banner when there's no connection (money values not persisted when app lock is on).

Run lint, typecheck, all tests, smoke and e2e. Commit: "test: harden coverage, performance and accessibility".
```

---

## Prompt 6: Security review

```
Build step 5 of Phase 6: a full security review against spec §11. Do it as a reviewer, with evidence for every point (test name, command output or code reference). Fix what fails.

1. Authentication and sessions (§11.1): OTP limits live, refresh reuse, revocation immediate, admin TOTP and lockout, test OTP impossible in production config.
2. Authorisation: route inventory (every route), ownership sweep – for every user-owned endpoint, Ravi gets 404 on Asha's ids and nothing changes; admin can't read money or titles.
3. Input and fetching (§11.3): Zod on every route; SSRF table against the running API; upload type/size; regex from user input; NoSQL injection attempts (objects in query params) rejected.
4. Data (§11.2): encrypted fields at rest; nothing sensitive in AsyncStorage/MMKV; HTTPS-only config for production; CORS allow-list; helmet headers on the admin panel.
5. Logs and third parties (§11.6): run a full flow with log capture; check Sentry scrubbing and PostHog properties.
6. Dependencies: npm audit (server, mobile, admin) – fix or justify each high/critical.
7. Secrets: git history scan for keys (gitleaks or a simple grep), .env files ignored, nothing secret in EXPO_PUBLIC_*.
Write the result to docs/SECURITY_REVIEW.md. Commit: "chore: security review".
```

---

## Prompt 7: Staging and production

```
Build step 6 of Phase 6. Spec §18.

1. Production config: NODE_ENV=production refuses console SMS, ALLOW_TEST_OTP, missing secrets, non-HTTPS CLIENT_URLS; trust proxy; structured JSON logs.
2. Dockerfile for the API and worker (one image, two start commands; Playwright Chromium included for the worker), and render.yaml (or railway.json – use the host we chose) with api + worker services, health check path, env var list (no values).
3. npm run db:indexes (dry run; --apply) to build all indexes in production; seed refuses production.
4. Deploy pipeline in GitHub Actions: on merge to main → build → deploy staging → run npm run smoke against staging with SMOKE_BASE_URL (a dedicated seeded test account on staging; never touch real users) → manual approval → production.
5. EAS: eas.json profiles (development, preview → staging API, production → production API) via EXPO_PUBLIC_API_URL per profile; EAS Update channels; app version and build number scheme.
6. docs/DEPLOYMENT.md: every account to create, every env var with where to get it, first deploy steps, rollback, how to run migrations and db:indexes, how to rotate ENCRYPTION_KEY and JWT secrets.
7. Give me a checklist of what I must do by hand, in order.

Run lint, typecheck, tests. Commit: "chore: add deployment config and pipeline".
```

**Check after**
- [ ] Follow `docs/DEPLOYMENT.md` and deploy staging
- [ ] The staging smoke run in CI is green
- [ ] Install the preview build on your phone (pointing at staging) and use it for 2–3 days

---

## Prompt 8: Store release preparation

```
Build step 7 of Phase 6: preparing the store release.

1. App config: app name, icons (all sizes), splash, permissions strings in plain English (photos, notifications, Face ID), iOS privacy manifest, Android data safety notes.
2. docs/STORE_LISTING.md: short and full descriptions (no claims we don't do: no automatic cart sync, comparison only from V2), keywords, category, age rating answers, screenshots list (which screens, which seed account), support URL and privacy policy URL needed.
3. docs/PRIVACY_POLICY.md and docs/TERMS.md drafts based on what the app actually collects (from the spec and the code) – mark them as drafts for legal review; DPDP grievance contact placeholder.
4. App Store privacy labels and Google Play data safety answers in docs/STORE_LISTING.md, derived from the actual data flows (phone, name, purchase intent data, photos, analytics only with consent, crash data).
5. Beta: TestFlight and Play internal testing steps; an in-app "Send feedback" link (mailto or a form URL).
6. A release checklist (docs/RELEASE_CHECKLIST.md) for every future release: version bump, changelog, smoke on staging, e2e on a release build, store notes.

Commit: "docs: prepare store release".
```

---

## Prompt 9: Finish Phase 6 and the MVP

```
Final step of Phase 6.

1. Verify the Phase 6 checklist and "Done when". Run lint, typecheck, all tests with coverage, npm run smoke (local and staging), npm run e2e:mobile on a release build.
2. Go through every MVP item in docs/ROADMAP.md (Phases 0–6) and give me a table: item | done? | test or evidence.
3. Update docs/ROADMAP.md (Phase 6 ✅, MVP gate section with the date we launch, notes) and spec §20 (hosting choices etc.).
4. Update CLAUDE.md: Current phase → "MVP live – waiting for the MVP gate before Phase 7"; Commands (admin, coverage, seed:large, db:indexes, deploy); "Phase 6 building blocks": admin routes and serializers (no user money/text), admin metrics module, track() wrapper and the property rule, Sentry scrubbing, deployment and release docs.
5. Commit: "docs: complete phase 6 – mvp ready".
6. Summary: what's live, what I must do by hand to launch, and the top 5 risks to watch in the first month.
```

**Then:** run the closed beta, fix issues, submit to both stores, launch. Watch the MVP gate in PostHog (activation 40 %, day-30 retention 25 %) before starting Phase 7.
