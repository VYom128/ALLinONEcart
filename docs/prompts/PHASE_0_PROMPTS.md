# ALLinONEcart – Phase 0 prompts for Claude Code

Paste these into Claude Code one at a time, in order. Wait for each to finish, check the result, then go on.

## Before Prompt 1 (do this yourself)

1. Create the project folder, e.g. `~/Desktop/ATP/ALLinONEcart/`.
2. Put these files in it:
   - `CLAUDE.md` (root)
   - `docs/PROJECT_SPEC.md`
   - `docs/ROADMAP.md`
3. Install: Node 24 LTS, Docker Desktop, Git, and on your phone the **Expo Go** app (Phase 0 only; from Phase 1 you'll use a development build). Optional: Android Studio or Xcode for a simulator.
4. Open the folder in your terminal and start Claude Code there.

---

## Prompt 1: Read and plan (no code)

```
We are starting Phase 0 of ALLinONEcart.

Read these first:
- CLAUDE.md
- docs/ROADMAP.md (the Phase 0 section)
- docs/PROJECT_SPEC.md sections §3 (all), §7.1–7.2, §15.3–15.4, §16 and §18 (local row)

Do NOT write any code yet. Give me:
1. The full folder tree you will create for Phase 0 (root, server, shared, mobile, mockstores).
2. The npm packages for each workspace (dependencies vs devDependencies), with one line on why each is needed.
3. How the shared package will be built and consumed by both the server (NodeNext, tsc build) and the Expo app (Metro).
4. The order you will build things in.
5. Anything in the spec that is unclear or conflicts for Phase 0.

Decisions already made (do not change them):
- Node 24 LTS, TypeScript strict, ES modules everywhere
- npm workspaces: server, shared, mobile, mockstores
- Server: express@4 (pin v4, not v5), mongoose 8, zod, pino + pino-http (+ pino-pretty for dev), dotenv, helmet, cors, compression, express-rate-limit, ioredis, bullmq; dev runs with tsx watch, build with tsc
- Mobile: Expo (latest SDK) created with create-expo-app (TypeScript, Expo Router), NativeWind (the version that matches the Expo SDK), Redux Toolkit + RTK Query
- Local services with Docker Compose: MongoDB 8 as a single-node replica set (rs0), Redis 7, MinIO
- Server tests: vitest + supertest + mongodb-memory-server (MongoMemoryReplSet) + ioredis-mock
- Mobile tests: jest-expo + @testing-library/react-native
- ESLint flat config + Prettier, concurrently

The existing files CLAUDE.md, docs/PROJECT_SPEC.md and docs/ROADMAP.md must not be modified or deleted in this prompt.

Wait for my approval before building.
```

**Check:** read the folder tree and package list carefully. Correct anything you don't like now. If it looks right, reply **"Approved, go ahead with Prompt 2 only"** and paste Prompt 2.

---

## Prompt 2: Monorepo, tooling and Git

```
Build step 1 of Phase 0: the monorepo and tooling. Do not write server or mobile application code yet.

1. Root package.json:
   - "private": true, "type": "module", workspaces ["shared", "server", "mobile", "mockstores"], "engines": { "node": ">=24" }
   - scripts:
     "dev" – concurrently runs dev:server, dev:worker, dev:mockstores and dev:mobile with coloured, named prefixes
     "dev:server" – npm run dev -w server
     "dev:worker" – npm run dev:worker -w server
     "dev:mockstores" – npm run dev -w mockstores
     "dev:mobile" – npm run start -w mobile
     "build:shared" – npm run build -w shared
     "lint", "lint:fix" – eslint over the whole repo
     "format", "format:check" – prettier
     "typecheck" – tsc --noEmit in every workspace
     "test" – npm run test:server && npm run test:mobile
     "test:server" – npm test -w server
     "test:mobile" – npm test -w mobile
   - "predev", "pretest" and "pretypecheck" run build:shared, so shared is always fresh.
2. tsconfig.base.json at the root (strict, ES2023, skipLibCheck); each workspace extends it.
3. shared/: package.json ("type": "module", "exports" pointing to dist with types), tsconfig (NodeNext, declaration), src/index.ts exporting nothing yet, build script (tsc).
4. server/: package.json ("type": "module") with scripts dev (tsx watch src/server.ts), dev:worker (tsx watch src/worker.ts), build (tsc), start (node dist/server.js), start:worker (node dist/worker.js), test (vitest run), test:watch (vitest). tsconfig with module/moduleResolution NodeNext.
5. mockstores/: package.json with a dev script; empty src/ for now (built in Prompt 6).
6. mobile/: create with create-expo-app (TypeScript, Expo Router). Remove the example screens and assets (keep the app icon and splash). Make sure Metro works in the npm workspaces monorepo (follow the current Expo monorepo guide).
7. eslint.config.js (flat config) at the root:
   - server, shared, mockstores: Node globals + typescript-eslint
   - mobile: eslint-config-expo (flat) + react-hooks
   - test files: vitest or jest globals as appropriate
   - eslint-config-prettier last
   - ignore node_modules, dist, coverage, .expo, mobile/android, mobile/ios
8. .prettierrc (singleQuote, semi, printWidth 100, trailingComma "all"), .prettierignore, .editorconfig (2 spaces, LF, final newline), .nvmrc (24).
9. .gitignore: node_modules, dist, coverage, .env and .env.* (but NOT .env.example), logs, *.log, .DS_Store, .expo, mobile/android, mobile/ios, *.keystore, minio data folder.
10. git init and the first commit, including the existing docs and CLAUDE.md: "chore: initialise monorepo and tooling".

Then run npm install, npm run lint, npm run format:check and npm run typecheck, and show me the results. Fix any errors before finishing.
```

**Check after**
- [ ] `npm install`, `npm run lint`, `npm run format:check` and `npm run typecheck` all pass
- [ ] `git log` shows the first commit and `git status` is clean

---

## Prompt 3: Local services with Docker Compose

```
Build step 2 of Phase 0: local services. Spec §18 (local row).

1. docker-compose.yml at the root:
   - mongo: image mongo:8, command --replSet rs0 --bind_ip_all, port 27017, a named volume, and a healthcheck that runs rs.initiate() with a single member (host "localhost:27017") if the replica set is not initiated yet, then reports healthy only when rs.status().ok is 1.
   - redis: image redis:7-alpine, port 6379, healthcheck redis-cli ping.
   - minio: image minio/minio, ports 9000 (API) and 9001 (console), named volume, default dev credentials from .env, healthcheck.
   - minio-init: a one-shot minio/mc container that creates the bucket "allinone-dev" and exits.
2. Root scripts: "services:up" (docker compose up -d --wait), "services:down", "services:logs".
3. Document the connection strings for server/.env.example (you will create that file in the next prompt):
   MONGO_URI=mongodb://localhost:27017/allinone?replicaSet=rs0&directConnection=true
   REDIS_URL=redis://localhost:6379

Then run npm run services:up, show that all containers are healthy, and prove the replica set works: run a small command (mongosh inside the container) that starts a session and a transaction and commits it. Show me the output.
Commit: "chore: add docker compose for mongo replica set, redis and minio".
```

**Check after**
- [ ] `docker compose ps` shows mongo, redis and minio as healthy
- [ ] The transaction test committed successfully
- [ ] MinIO console opens at `http://localhost:9001`

---

## Prompt 4: Server basics (config, logger, errors, responses)

```
Build step 3 of Phase 0: the server basics. Follow CLAUDE.md conventions.

Create:

1. server/src/config/env.ts
   - Load dotenv, then validate process.env with Zod:
     NODE_ENV: 'development' | 'test' | 'production' (default 'development')
     PORT: number (default 5000; .env.example sets 5001 because macOS AirPlay uses 5000)
     MONGO_URI: string, required except when NODE_ENV=test
     REDIS_URL: string, required except when NODE_ENV=test
     CLIENT_URLS: comma-separated list of URLs, parsed into an array (default http://localhost:5173)
     LOG_LEVEL: 'fatal'|'error'|'warn'|'info'|'debug'|'trace'|'silent' (default 'info')
     RATE_LIMIT_WINDOW_MS (default 900000), RATE_LIMIT_MAX (default 300)
   - On failure: print which variables are invalid (names and reasons only, never values) and exit with code 1.
   - Export a frozen config object with config.isProd, config.isTest, config.isDev.
   - Create server/.env.example with every variable and a one-line comment for each. List the later-phase variables from spec §3.6 as commented-out lines with the phase number.

2. server/src/config/constants.ts
   - ERROR_CODES from spec §16 as a frozen object, and ERROR_HTTP_STATUS mapping each code to its status.
   - Re-export enums from the shared package (there are none yet; leave a comment).

3. server/src/utils/logger.ts
   - Pino. Development: pino-pretty. Production: JSON. Test: level 'silent'.
   - Redact: req.headers.authorization, req.headers.cookie, and any *.password, *.token, *.accessToken, *.refreshToken, *.otp, *.code, *.phone.
   - serializeError(err) → { name, message, stack, code? } only, never the raw error object (raw errors can carry request bodies).

4. server/src/utils/ApiError.ts
   - class ApiError extends Error { constructor(statusCode, message, code, details?) }, isOperational = true
   - Static helpers: badRequest, unauthorized, forbidden, notFound, conflict, unprocessable, tooManyRequests, internal, serviceUnavailable. Each takes (message, details?) and uses the right ERROR_CODES entry.

5. server/src/utils/ApiResponse.ts
   - sendSuccess(res, { statusCode = 200, message = 'OK', data = null, meta })
     → { success: true, message, data, meta? } (leave meta out when undefined)

6. server/src/utils/asyncHandler.ts – wraps async route handlers and forwards errors to next().

7. server/src/utils/pagination.ts
   - parsePagination(query) → { page, limit, skip } (defaults page 1, limit 20, max 100) for the admin panel
   - encodeCursor / decodeCursor (opaque base64url of "<isoDate>|<id>") for user-facing lists
   - Not used yet; later phases need them. Add unit tests in the next test prompt.

8. server/src/utils/money.ts – assertPaise(n) (safe integer ≥ 0), rupeesToPaise(rupees: string | number) without float errors, paiseToRupeeString(paise). Unit tests later.

Add TSDoc comments to every exported function. Run lint and typecheck, then commit: "feat(server): add config, logger and response utilities".
```

**Check after**
- [ ] `npm run lint` and `npm run typecheck` pass
- [ ] `server/.env.example` lists every variable with a comment

---

## Prompt 5: Middleware, app, database, Redis, worker and health

```
Build step 4 of Phase 0: middleware, app wiring, connections, the worker entry point and the health endpoint.

1. server/src/middlewares/requestId.ts – reuse the incoming X-Request-Id only if it matches [A-Za-z0-9_-]{8,64}, otherwise crypto.randomUUID(). Set req.id and the X-Request-Id response header.

2. server/src/middlewares/validate.ts
   - validate({ body, query, params }) – each an optional Zod schema.
   - Parse and replace req.body / req.query / req.params with the parsed values (unknown fields stripped).
   - On failure call next(zodError); the error handler formats it.

3. server/src/middlewares/notFound.ts – 404 NOT_FOUND "Route not found: METHOD /path".

4. server/src/middlewares/errorHandler.ts – every error becomes:
   { success: false, message, error: { code, details? }, requestId } (+ stack in development only)
   - ApiError → its status, code and details
   - ZodError → 400 VALIDATION_ERROR, details [{ field: 'body.title', message }]
   - Mongoose ValidationError → 400 VALIDATION_ERROR with field details
   - Mongoose CastError → 400 BAD_REQUEST "Invalid <path>"
   - Duplicate key (11000) → 409 CONFLICT with details.fields only (never the values)
   - express.json parse error → 400 BAD_REQUEST "Malformed JSON"
   - body too large → 413 PAYLOAD_TOO_LARGE
   - anything else → 500 INTERNAL_ERROR; hide the real message in production
   - Log 5xx at error and 4xx at warn, with req.id and serializeError(). Never log the request body or query string.

5. server/src/middlewares/rateLimiters.ts – createRateLimiter({ windowMs, max }) factory, and apiLimiter from config. Its handler returns the standard error format with RATE_LIMITED, status 429 and details.retryAfterSeconds. apiLimiter is skipped when NODE_ENV=test.

6. server/src/config/db.ts – connectDB() / disconnectDB(); mongoose.set('strictQuery', true); log connected / disconnected / error (never the URI). After connecting, check that the server is a replica set and log a clear error if not (transactions need it).
   server/src/utils/transaction.ts – withTransaction(async (session) => …) helper.

7. server/src/config/redis.ts – getRedis() returns a shared ioredis client (lazyConnect, maxRetriesPerRequest null for BullMQ); redisStatus() returns 'connected' | 'connecting' | 'disconnected'; closeRedis(). In tests getRedis() returns an ioredis-mock instance.

8. server/src/routes/health.routes.ts – GET /health → sendSuccess with { status: 'ok', uptime, timestamp, db, redis } (db from mongoose.connection.readyState as 'connected' | 'disconnected' | 'connecting' | 'disconnecting'). Always 200 while the API runs.

9. server/src/routes/index.ts – mounts health; later modules are mounted here.

10. server/src/app.ts – createApp({ extraRoutes? }) returns the Express app without listening. Middleware order:
    app.set('trust proxy', 1) → requestId → pino-http (use req.id, log path without query, quiet /health in dev) → helmet → cors({ origin: CLIENT_URLS, credentials: true }) → compression → express.json({ limit: '1mb' }) → apiLimiter on /api → routes at /api/v1 → extraRoutes (tests only) → notFound → errorHandler

11. server/src/server.ts – connect DB and Redis, then listen on PORT and log the URL. On SIGINT/SIGTERM: stop accepting connections, close Redis and the DB, exit 0 (force exit after 10 s). On unhandledRejection / uncaughtException: log fatal, exit 1. If the port is busy, log a clear message and exit 1 (never kill the other process).

12. server/src/worker.ts – connects to DB and Redis, logs "worker ready", registers no queues yet (comment: queues come in Phase 2), and shuts down gracefully the same way.

13. Empty folders with .gitkeep for later phases: server/src/modules, server/src/policies, server/src/adapters, server/src/jobs, server/src/services.

Then: create server/.env from .env.example, make sure npm run services:up is running, start the server and the worker, call curl http://localhost:5001/api/v1/health and an unknown route, and show me both responses and the worker log line.
Run lint and typecheck. Commit: "feat(server): add middleware, error handling, connections, worker and health route".
```

**Check after**
- [ ] `/health` shows `db: connected` and `redis: connected`
- [ ] The unknown route returns the standard 404 body with a `requestId`
- [ ] Stopping Docker's Redis (`docker compose stop redis`) makes `/health` show `redis: disconnected` without crashing; start it again afterwards

---

## Prompt 6: Server tests, mockstores, smoke and seed skeleton

```
Build step 5 of Phase 0: tests and the seed-test tooling. Spec §15.1, §15.3–15.5.

1. server/vitest.config.ts – environment node, setupFiles ['./tests/setup.ts'], testTimeout 30000, coverage v8 (include src/**).
2. server/tests/setup.ts – set NODE_ENV=test before the app is imported; start a MongoMemoryReplSet (1 member) per test file in beforeAll, connect mongoose, disconnect and stop in afterAll.
3. server/tests/helpers/testApp.ts – api(extraRoutes?) builds createApp({ extraRoutes }) and returns a supertest agent bound to 127.0.0.1 (one server per file; never request(app) directly).
4. server/tests/helpers/errors.ts – expectErrorShape(res, status, code) checks the full error body (success false, message, error.code, requestId).

Tests:
- health.test.ts: 200, data.status 'ok', data.db 'connected', data.redis present, X-Request-Id header present.
- notFound.test.ts: unknown route → 404 NOT_FOUND with the standard shape.
- validate.test.ts (test-only route with { name: string min 2, age: int positive }): invalid body → 400 with both field details; extra field stripped; query validation works.
- errorHandler.test.ts: ApiError.conflict → 409; plain Error → 500; CastError → 400; duplicate key → 409 with details.fields and no value; async rejection caught.
- malformedJson.test.ts → 400 BAD_REQUEST; payloadTooLarge.test.ts (> 1 MB) → 413.
- requestId.test.ts: a valid incoming id is echoed; an invalid one is replaced.
- rateLimit.test.ts: createRateLimiter({ max: 2 }) → third request 429 RATE_LIMITED with retryAfterSeconds.
- logging.test.ts: capture logger output during a request with a body containing a password, a phone number and a query string; none of them appear in the logs.
- unit tests for pagination (cursor round trip), money (rupeesToPaise('1499.99') === 149999, no float errors, rejects negatives) and env validation (missing MONGO_URI outside test fails with the variable name only).

5. mockstores/: a tiny HTTP server (Node http or express) that serves static files from mockstores/stores/** and has GET /__health. Add one placeholder page mockstores/stores/generic/example.html. Export startMockstores({ port: 0 }) → { url, close } so tests can start it on a random port. (Store fixtures come in Phase 2.)

6. Smoke tests – server/smoke/smoke.ts, run with "npm run smoke" at the root:
   - If an API answers on PORT, use it and leave it running; otherwise start a temporary server on a free port and stop only that one.
   - Checks: /health is ok with db connected and redis connected; an unknown route returns the standard 404 with a requestId; X-Request-Id is echoed.
   - Prints a ✓/✗ line per check and exits 1 on any failure.
   - Structure it so later phases add checks in separate files (smoke/checks/<phase>.ts).

7. Seed skeleton – server/src/seed/index.ts, run with "npm run seed" (and "npm run seed -- --reset"):
   - Refuses to run when NODE_ENV=production.
   - Connects, runs the list of seeders (empty for now), prints documents per collection, disconnects.
   - Create server/src/seed/expectations.json as {} with a README note: golden numbers are added by hand when seed data is added.

Run npm test, npm run seed and npm run smoke, and show me the results. All must pass. Commit: "test(server): add phase 0 tests, mockstores, smoke and seed skeleton".
```

**Check after**
- [ ] `npm run test:server` passes
- [ ] `npm run seed` runs (twice, no errors)
- [ ] `npm run smoke` prints ✓ for every check, both with the server already running and with it stopped

---

## Prompt 7: Shared package and the Expo app

```
Build step 6 of Phase 0: the shared package and the mobile app shell. Spec §3.5, §13.2–13.3.

Shared package:
1. shared/src/enums.ts – SECTIONS ('cart' | 'goal'), CART_STATUSES, GOAL_STATUSES, GOAL_HORIZONS, PRIORITIES (spec §1.4, §5.1) as const arrays with TypeScript types, and two separate machines STATE_MACHINES.cartItem and STATE_MACHINES.goal with the transition tables from spec §5.1. Cart and Goals are separate sections (spec D6) – never one shared item machine.
2. shared/src/stateMachine.ts – canTransition(machine, from, to). (The server's assertTransition wraps it later.)
3. shared/src/api.ts – TypeScript types for the success and error response bodies and for the health payload.
4. Unit tests for canTransition covering every allowed and a sample of disallowed transitions for both machines (vitest in shared).
5. Re-export the enums from server/src/config/constants.ts.

Mobile app:
6. mobile/.env.example → EXPO_PUBLIC_API_URL=http://localhost:5001/api/v1 with a comment explaining that a physical phone needs the computer's LAN IP. Copy to mobile/.env (gitignored).
7. NativeWind set up for the current Expo SDK. Design tokens in the Tailwind config: canvas, surface, ink, muted, line, primary (50–900), success, warning, danger; radius card and control; light and dark mode.
8. mobile/src/store/ – Redux store, RTK Query api (src/store/api.ts) with a fetchBaseQuery on EXPO_PUBLIC_API_URL, timeout 15 s. Normalise errors to { status, message, code, details, requestId }; network errors → status 0, code 'NETWORK_ERROR', message "Can't reach the server". Endpoint getHealth.
9. mobile/src/components/ui – Screen (safe area + background), Card, Button, StatusPill, Skeleton, ErrorState. Accessibility labels on touchables.
10. mobile/src/features/health/HealthCard.tsx – shows loading (skeleton), success (API ok, DB and Redis status, uptime, server time) and error (message + Retry).
11. Routes: app/_layout.tsx (Redux Provider, theme, status bar), app/index.tsx (temporary home: app name + HealthCard; it becomes the dashboard later), app/+not-found.tsx.
12. Tests with jest-expo + React Native Testing Library: HealthCard loading, success and error states (mock the query hook), and the error normaliser.

Then run npm run dev at the root, open the app on my phone with Expo Go (show me the QR code step) or a simulator, and confirm it shows "API: ok · DB: connected · Redis: connected". Run lint, typecheck and npm test. Commit: "feat(mobile): add shared enums and app shell with health screen".
```

**Check after**
- [ ] On your phone, the app shows API ok, DB connected and Redis connected (set `EXPO_PUBLIC_API_URL` to your Mac's LAN IP)
- [ ] Turn Wi-Fi off on the phone: the card shows "Can't reach the server" and Retry works when it's back on
- [ ] `npm test` runs server, shared and mobile tests and all pass

---

## Prompt 8: CI, README, final check and roadmap update

```
Final step of Phase 0.

1. GitHub Actions (.github/workflows/ci.yml) on push and pull request:
   - job "check": Node 24, npm ci, build shared, lint, format:check, typecheck, test
   - job "smoke": npm ci, docker compose up -d --wait (mongo, redis), create server/.env from .env.example, npm run seed, npm run smoke
2. README.md at the root:
   - summary (2–3 lines) and links to docs/PROJECT_SPEC.md and docs/ROADMAP.md
   - prerequisites (Node 24, Docker Desktop, Expo Go / dev build, simulator optional)
   - setup: clone, npm install, npm run services:up, copy server/.env.example → server/.env and mobile/.env.example → mobile/.env (LAN IP note), npm run seed, npm run dev
   - scripts table
   - folder structure (short)
   - API response format (success and error examples)
   - "How to add a backend module": a short example of modules/<feature>/routes.ts + controller using validate, asyncHandler, sendSuccess and ApiError
   - "How to add a smoke check" and "How the seed and golden numbers work"
3. Go through the Phase 0 checklist and "Done when" in docs/ROADMAP.md and verify each item. Actually run: npm run lint, npm run format:check, npm run typecheck, npm test, npm run seed, npm run smoke, and a start of the server with MONGO_URI unset (it must exit with a clear message naming the variable). Report anything missing and fix it.
4. Confirm no secrets are committed (git ls-files | grep -i env should show only .env.example files) and that no code path logs request bodies or query strings.
5. Update docs/ROADMAP.md: tick the Phase 0 items, set Phase 0 to ✅ Done and Phase 1 to 🟡 In progress, and add any decisions under "Notes / decisions" (also record spec divergences in spec §20 "Decisions made" with the next D-number).
6. Update CLAUDE.md: set "Current phase" to Phase 1 with its spec sections from the roadmap, keep the Commands list accurate, and add a "Phase 0 building blocks (reuse, don't reinvent)" section listing the helpers later phases must reuse (env/config, ERROR_CODES, ApiError helpers, sendSuccess, validate, withTransaction, money utils, cursor helpers, getRedis, test helpers api() and expectErrorShape(), mockstores, smoke structure, seed structure, mobile api/error normaliser and UI kit).
7. Commit: "docs: complete phase 0".
8. Give me a short summary: what was built, anything I must do by hand, and anything you'd flag before Phase 1.
```

**Check after**
- [ ] Push to GitHub: both CI jobs are green
- [ ] Follow your own README on a clean clone. It should work without asking Claude Code anything.

---

## When Phase 0 is finished (only if you skipped parts of Prompt 8)

```
Phase 0 is finished. Before we move on:

1. Check every item in the Phase 0 checklist in docs/ROADMAP.md and tell me if anything is missing or not working.
2. Tick the completed items, set Phase 0 to ✅ Done and Phase 1 to 🟡 In progress, and add any decisions to "Notes / decisions".
3. Update the "Current phase" section in CLAUDE.md to Phase 1, and add any new conventions from this phase that later phases must follow.
4. Commit with the message "docs: complete phase 0".
```

---

## Tips

- **Read the plan first.** After Prompt 1, check the folder tree and package list before approving. Fixing a plan is much easier than fixing code.
- **One prompt at a time.** Don't paste the next prompt until every "Check after" box is ticked.
- **When something breaks**, paste the exact error into Claude Code: *"This is failing: <error>. Fix the cause without deleting or weakening tests, then run the checks again."*
- **Watch for test weakening.** If Claude Code deletes a test, adds `.skip`, or changes an expected value without explaining why, ask it to stop and explain.
- **Expo Go is fine for Phase 0 only.** Phase 1 (secure storage and Google/Apple sign-in) and Phase 3 (share sheet) need an Expo development build. Phase 1's first prompt sets that up.
- **Start Phase 1 in a new session.** After Prompt 8, run `/clear` so the new session starts from the updated `CLAUDE.md`, not a long Phase 0 conversation.
