# ALLinONEcart – All-in-One Cart & Life Goals App

A mobile app with two separate sections:
- **Cart** – every store's cart in one place (my Myntra cart, Amazon cart, Zara cart, H&M cart, Bear House cart, Flipkart cart…), saved by sharing product links, grouped by store, with live prices, Buy and, in V2, exact-match price comparison.
- **Goals** – big life goals (house, Porsche, BMW, trips) with target prices, savings progress, hours of work, a vision board and an achieved wall.

- Full requirements: `docs/PROJECT_SPEC.md` (source of truth; cite sections like §8.3)
- Build plan and progress: `docs/ROADMAP.md`

Read the relevant spec sections for the current phase before planning. Do not read the whole spec every time.

## Current phase
**Phase 1 – Authentication and accounts.** Spec: §2 (roles, permissions), §5.5 (user account states), §6.3–6.5 (`users`, `sessions`, `otp_challenges`), §6.14 (`audit_logs`), §7.3–7.4 (`/auth`, `/me`), §11.1 (auth and sessions), §11.4 (audit log), §11.6 (logging), §13.1–13.2 (route map, mobile state). Phone OTP and Google/Apple sign-in, secure sessions, profile and an append-only audit log. From this phase the app needs an Expo **development build** (expo-secure-store, Google/Apple sign-in) instead of Expo Go. Build on the Phase 0 building blocks below. Only build what the current phase prompt asks for; no features from later phases. If something seems to need a later-phase feature, ask first.

## Stack
- Monorepo with npm workspaces: `server/`, `mobile/`, `shared/` (later `admin/`); `mockstores/` is a small test server
- Server: Node 24 LTS, Express 4 (pinned), Mongoose 8, Zod, Pino + pino-http, BullMQ + ioredis, helmet, cors, compression, express-rate-limit
- Mobile: Expo (latest SDK), Expo Router, Redux Toolkit + RTK Query, NativeWind, react-hook-form + Zod, expo-secure-store
- Shared: Zod schemas, enums, state machines and types used by server and mobile
- TypeScript strict with ES modules. Server imports use `.js` extensions (NodeNext).
- Tests: server Vitest + Supertest + mongodb-memory-server (replica set); mobile jest-expo + React Native Testing Library; E2E Maestro (from Phase 3)
- Local services (Docker Compose): MongoDB 8 single-node replica set, Redis 7, MinIO; mockstores runs as a workspace process (spec D7)

## Commands
(Built in Phase 0; keep this list up to date as scripts are added.)
- `npm run services:up` – start MongoDB (replica set rs0), Redis and MinIO, wait until healthy and create the `allinone-dev` bucket; `services:down`, `services:logs`. (A plain `docker compose up -d` starts the services but not the bucket step.)
- Ports: API 5001 (macOS AirPlay holds 5000), Metro 8081, mockstores 4010, MongoDB **27018** on the host (`mongodb://localhost:27018/allinone?replicaSet=rs0&directConnection=true`), Redis 6379, MinIO 9000/9001.
- `npm run dev` – API + worker + mockstores + Expo. Expo prints no QR code there (no terminal): open `exp://<LAN-IP>:8081`, or run `npm run dev:backend` (API + worker + mockstores) and `npm run dev:mobile` in two terminals. One process: `dev:server`, `dev:worker`, `dev:mockstores`, `dev:mobile`.
- `npm test` – shared, then server, then mobile tests; `npm run test:shared` / `test:server` / `test:mobile`; `npm run test:coverage` (server)
- `npm run lint` / `lint:fix` / `format` / `format:check` / `typecheck`
- `npm run build:shared` – runs automatically before dev, test, typecheck, seed and smoke
- `npm run seed` – load the seed (§15.5); `npm run seed -- --reset` wipes first. Refuses in production.
- `npm run smoke` – API smoke tests against a running API with the seed loaded (reuses a server on `PORT`, otherwise starts a temporary one on a free port and stops only that one)
- On a physical phone set `EXPO_PUBLIC_API_URL` to your computer's LAN IP (e.g. `http://192.168.1.20:5001/api/v1`).

## Phase 0 building blocks (reuse, don't reinvent)
Server (`server/src/`):
- **Config:** `config` from `config/env.ts` (frozen; `isDev`/`isTest`/`isProd`); `parseEnv()` for tests. New vars: Zod schema + `server/.env.example`.
- **Constants:** `ERROR_CODES`, `ERROR_HTTP_STATUS`, `ErrorCode` and everything from `@allinone/shared`, all via `config/constants.ts`.
- **Errors:** `ApiError` helpers `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessable` (422 BUSINESS_RULE_VIOLATION), `tooManyRequests`, `internal`, `serviceUnavailable`; `ApiError.of(code, message, details)` for any other code. `errorHandler` already maps Zod, Mongoose validation/cast, duplicate key (`details.fields`), malformed JSON and 413.
- **Responses:** `sendSuccess(res, { statusCode, message, data, meta })` (`utils/ApiResponse.ts`); `asyncHandler()` for async controllers.
- **Middleware:** `validate({ body, query, params })` (strips unknown fields; details as `body.title`); `createRateLimiter({ windowMs, max, skip })` for per-route limits (auth, extract); `requestId` + `getRequestId(req)`; `notFound`.
- **Data:** `connectDB()` / `disconnectDB()` / `dbStatus()`; `withTransaction(async (session) => …)` (`utils/transaction.ts`; the callback may run twice – writes only); `getRedis()` (shared ioredis client, ioredis-mock in tests; reuse its options for BullMQ), `connectRedis()`, `redisStatus()`, `closeRedis()`.
- **Utils:** money `assertPaise()`, `rupeesToPaise()`, `paiseToRupeeString()`, `MAX_AMOUNT_PAISE`; pagination `parsePagination()` (admin), `encodeCursor()` / `decodeCursor()` (feeds; invalid → 400); logging `logger`, `serializeError()`, `createLogger(options, stream)` (tests); process `exitOnUnhandledErrors()`, `onShutdown(name, cleanup)` (API and worker).
- **App:** `createApp({ extraRoutes })` (`app.ts`); mount modules in `routes/index.ts`.

Shared (`shared/src/`): `SECTIONS`, `CART_STATUSES`, `GOAL_STATUSES`, `GOAL_HORIZONS`, `PRIORITIES`; `STATE_MACHINES.cartItem` / `.goal` (separate, D6); `canTransition()`, `isInitialStatus()` (wrap them in the server's `assertTransition()`); API body types `ApiSuccess`, `ApiFailure`, `ApiFieldError`, `HealthData`.

Tests and tooling:
- `tests/setup.ts` gives every server test file its own in-memory replica set (MongoDB 8.2.6) and `NODE_ENV=test`.
- `api(extraRoutes?)` (`tests/helpers/testApp.ts`): call it once per file at the top level; never `request(app)`. `expectErrorShape(res, status, code)` (`tests/helpers/errors.ts`) checks the full error body. `useMockstores()` (`tests/helpers/mockstores.ts`) → `.url`.
- To capture logs in a test, `vi.mock('../src/utils/logger.js')` with `createLogger({ level }, stream)`; see `tests/logging.test.ts`.
- mockstores: `startMockstores({ port: 0 })` → `{ url, close }`; pages in `mockstores/stores/<store>/*.html`.
- Smoke: one file per phase in `server/smoke/checks/<phase>.ts` (a `SmokeCheck[]`), appended in `checks/index.ts`; a check fails by throwing (`node:assert/strict`).
- Seed: add idempotent seeders to `SEEDERS` in `server/src/seed/index.ts`; golden numbers in `expectations.json` (separate `cart` and `goals` blocks, hand-computed).

Mobile (`mobile/src/`):
- One RTK Query `api` (`store/api.ts`); features add endpoints with `api.injectEndpoints()` in `features/<feature>/api.ts` and unwrap `data` with `transformResponse`.
- Errors are already `AppError` `{ status, message, code, details, requestId }` (`store/normalizeError.ts`; status 0 = network or timeout, spec D9). `makeStore()`, `useAppDispatch`, `useAppSelector` in `store/index.ts`. `API_URL` in `config/env.ts`.
- UI kit `components/ui`: `Screen`, `Card`, `Button` (44 pt, loading/disabled, accessibility label), `StatusPill` (text + colour), `Skeleton`, `ErrorState` (Retry). `formatDuration()`, `formatTime()` in `utils/format.ts`.
- Design tokens are CSS variables in `mobile/global.css` (light + dark), mapped in `tailwind.config.js` (`bg-canvas`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `primary-50…900`, `success`, `warning`, `danger`, `on-primary`, `rounded-card`, `rounded-control`).
- Mobile tests: jest-expo + RNTL 14 – `await render()` and `await fireEvent.press()`; mock a feature's hook with `jest.mock('../../api')` (see `HealthCard.test.tsx`).

Gotchas: TypeScript 6 needs explicit `"types"` in tsconfigs; install Expo packages with `npx expo install` (then move dev-only ones to devDependencies); new install scripts need `npm install-scripts approve <pkg>`.

## Backend conventions (always follow)
- Features live in `server/src/modules/<feature>/` with `model.ts`, `service.ts`, `controller.ts`, `routes.ts`, `validation.ts`, `serializer.ts`.
- Controllers are thin; business logic goes in services; ownership and admin rules go in `server/src/policies/`.
- Every protected route: `authenticate` → `authorize(...roles)` → `validate()` (Zod) → controller wrapped in `asyncHandler`.
- Respond with `sendSuccess()`; throw `ApiError` for failures. Never send raw Mongoose documents – use serializers.
- Response format: `{ success, message, data, meta }` or `{ success: false, message, error: { code, details }, requestId }`. Error codes: spec §16. Use `ERROR_CODES` (never string literals); add new codes to both `ERROR_CODES` and `ERROR_HTTP_STATUS` and to spec §16.
- Validation errors are `details: [{ field: 'body.title', message }]`. Let Zod/Mongoose errors bubble to `errorHandler`; never format errors in controllers.
- API routes under `/api/v1`; mount modules in `server/src/routes/index.ts`. Status changes use action endpoints (`POST /goals/:id/achieve`, `POST /cart/:id/bought`), never a generic status PATCH.
- **Cart and Goals are separate sections (spec D6).** Separate collections (`cart_items`, `goals`), modules (`modules/cart`, `modules/goals`), endpoints (`/cart`, `/goals`), categories (`section`), state machines, screens and totals. Never write code that converts one into the other, shares one "item" model, or adds Cart and Goals totals together.
- Enums and state machines live in `shared/src/enums` and are re-exported from `server/src/config/constants.ts`. Every status change calls `assertTransition()` and a conditional update.
- **Money is integer paise** (`*Paise` fields) plus `currency`. Never floats. Format only at the edge.
- Dates stored in UTC; month values are `YYYY-MM`; "today" and monthly jobs use the user's `timezone`.
- User-owned data: every query filters by `user`; another user's record is a **404**, never 403.
- Multi-document writes use transactions (`withTransaction`); MongoDB always runs as a replica set (also in tests).
- Config only from the frozen `config` object in `server/src/config/env.ts` – never read `process.env` elsewhere. Add each new env var to the Zod schema and `server/.env.example` (with a comment) in the phase that needs it.
- Slow or external work (store fetching, images, comparisons, pushes) runs as BullMQ jobs in the worker. Jobs are idempotent, export `runX(now)` for tests, and never throw out of the processor.
- Store pages are read only through the safe fetcher and the adapters (`server/src/adapters/`). Tests never call real stores – use mockstores.
- Logging: use `logger` (never `console`); log errors via `serializeError(err)`.

## Mobile conventions
- Routes in `mobile/app/` (Expo Router). Feature code in `mobile/src/features/<feature>/` (`api.ts`, `components/`, `screens/`, `schemas.ts`).
- Server data through RTK Query only. Access token in memory (Redux); refresh token in expo-secure-store only – never AsyncStorage.
- Build screens from `src/components/ui`; extend the kit instead of hand-rolling controls. Design tokens in the NativeWind config – no raw hex colours.
- Every screen has loading, empty and error states; works from 360 pt wide; every touchable has an accessibility label.
- Money shown with `formatINR(paise)`; amounts typed in ₹ and sent as paise (`MoneyField`).
- Never compute business numbers (totals, hours of work, milestones) in the app – show the server's values.
- Cart and Goals are separate tabs and screens; no screen lists both. Home shows a Cart card and a Goals card side by side, never a combined total.

## Testing rules (seed tests)
- Every task adds tests: unit tests for new logic, API tests for every new endpoint (success, validation, 401, other user's record 404), and, where a feature touches seeded data, a step in `npm run smoke`.
- The seed is fixed. `server/src/seed/expectations.json` holds hand-computed golden numbers; tests compare against them. Only change it when the seed is changed on purpose, and say so.
- Never delete, skip or weaken a test to make it pass; fix the code. If a test is wrong, explain why before changing it.
- Before saying a task is done: `npm run lint`, `npm run typecheck`, `npm test` and (from Phase 1) `npm run smoke` must pass. Show the results.

## Security rules
- Never log request bodies, tokens, OTPs, phone numbers, URLs with query strings, cart/goal titles, notes or money values.
- Never put cart/goal titles, prices, income or notes in push notifications, analytics events or audit metadata – ids only.
- Admins never read users' income, contributions, cart items or goals (aggregates only).
- Fetch store pages only through the safe fetcher (blocks private IPs, size and time limits).
- Secrets only from env; nothing secret in the app bundle (`EXPO_PUBLIC_*` is public).

## Workflow
- Never stop or kill a process you did not start (e.g. `kill $(lsof -ti :5001)`): the user's `npm run dev` may be on that port. Check the port first; stop your own processes by the PID you started.
- Show a short plan and wait for approval before large changes.
- Commit after each step with a conventional commit message.
- At the end of a phase: update `docs/ROADMAP.md` (tick items, add notes), update "Current phase" above, add a "Phase N building blocks (reuse, don't reinvent)" section listing the helpers, patterns and test fixtures later phases must reuse, and commit.
- If the code must differ from the spec, say so and record it in spec §20 ("Decisions made", next D-number) instead of diverging silently.
