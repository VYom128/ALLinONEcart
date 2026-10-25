# ALLinONEcart – Phase 1 prompts: Authentication and accounts

**Goal:** phone OTP and Google/Apple sign-in, secure sessions, profile, an append-only audit log, and the app's signed-in shell.
**Spec:** §2, §5.5, §6.3–6.5, §6.14, §7.3–7.4, §11.1, §11.4, §11.6, §13.1–13.2

Start a fresh Claude Code session (`/clear`). `CLAUDE.md` should already say "Current phase: Phase 1".

---

## Prompt 1: Read and plan (no code)

```
We are starting Phase 1 of ALLinONEcart: authentication and accounts.

Read these first:
- CLAUDE.md (including the Phase 0 building blocks)
- docs/ROADMAP.md (the Phase 1 section)
- docs/PROJECT_SPEC.md sections §2, §5.5, §6.3–6.5, §6.14, §7.3–7.4, §11.1, §11.4, §11.6, §13.1–13.2

Do NOT write code yet. Give me:
1. The new files and folders for server, shared and mobile.
2. New packages per workspace and why (e.g. jsonwebtoken, google-auth-library, apple-signin-auth or jose, otplib, bcrypt, expo-secure-store, expo-auth-session or @react-native-google-signin, expo-apple-authentication, expo-dev-client, eas-cli).
3. New env vars (name, phase, default, required where).
4. The token and session design in your own words: access token claims, refresh rotation, the reuse grace window, how the mobile app stores and refreshes tokens, and how revocation takes effect immediately.
5. How OTP limits work (per phone, per IP, attempts, resend) and how test numbers are allowed only outside production.
6. The audit log design (append-only hooks, hash chain, when entries are written).
7. The build order, as numbered steps that match the next prompts.
8. Anything unclear or conflicting in the spec.

Wait for my approval before building.
```

**Check:** the refresh-token design must use hashed tokens, rotation and reuse detection, and the mobile app must keep the refresh token in SecureStore only. Reply **"Approved, go ahead with Prompt 2 only"**.

---

## Prompt 2: Models, SMS service and audit log

```
Build step 1 of Phase 1. Server only.

1. shared/src/enums.ts: add ROLES ('user' | 'admin'), USER_STATUSES (spec §5.5), AUTH_PROVIDERS, SESSION_REVOKE_REASONS, AUDIT_ACTIONS (spec §11.4). Re-export from server constants.
2. Env (Zod + .env.example with comments): JWT_ACCESS_SECRET (≥ 32 chars, required outside test), JWT_ACCESS_EXPIRES_IN (15m), REFRESH_TOKEN_TTL_DAYS (30), OTP_TTL_SECONDS (300), OTP_MAX_ATTEMPTS (5), SMS_TRANSPORT ('console' | 'msg91' | 'twilio'; refuse 'console' in production), SMS_API_KEY, SMS_SENDER_ID, ALLOW_TEST_OTP (refuse true in production), GOOGLE_CLIENT_IDS, APPLE_BUNDLE_ID, AUDIT_HASH_SECRET (≥ 32 chars).
3. Models in server/src/modules/: users/model.ts, sessions/model.ts, otp/model.ts exactly as spec §6.3–6.5 (indexes, select:false fields, TTL index on otp expiresAt). User toJSON never exposes passwordHash or totpSecret.
4. server/src/services/sms/: an SmsTransport interface, a console transport (logs "OTP sent to ••••1234" and, in dev/test only, the code), and one real transport (MSG91 by default) behind it. getSms() picks from config.
5. Audit: server/src/modules/audit/model.ts (spec §6.14) with append-only hooks – every update/delete/replace query, document save of an existing entry, insertMany of existing ids and bulkWrite throw ApiError 409 RECORD_LOCKED. services/audit.service.ts:
   - record({ action, actor, target, request, metadata }) – queued in-process so entries are written in order, assigns seq, prevHash, hash = HMAC(AUDIT_HASH_SECRET, canonical JSON of the entry + prevHash). Never throws: failures are logged with serializeError.
   - metadata keeps ids and field names only; keys matching password|token|secret|otp|code|phone are redacted.
   - verifyChain() → { ok, checked, firstBrokenId?, reason? }.
   - buildRequestMeta(req) → { requestId, ipHash, userAgent }.
6. Tests: model constraints, append-only (every write path → RECORD_LOCKED), chain verification detects a tampered entry, redaction, SMS transport selection and the production refusals in env.

Run lint, typecheck and tests. Commit: "feat(auth): add user, session, otp and audit models".
```

**Check after**
- [ ] `npm test` passes, including the append-only tests
- [ ] Starting the server with `ALLOW_TEST_OTP=true NODE_ENV=production` fails with a clear message

---

## Prompt 3: OTP login, tokens and sessions

```
Build step 2 of Phase 1: phone OTP sign-in and sessions. Spec §7.3, §11.1.

1. modules/auth/:
   - POST /auth/otp/request { phone } – normalise to E.164 (India default +91; utils/phone.ts with tests). Always the same response { resendAfterSeconds } whether the number exists or not. Limits: resend after 30 s, 5 requests / hour / phone, 20 / hour / IP → 429 RATE_LIMITED with retryAfterSeconds. Codes are 6 random digits (crypto), stored hashed (SHA-256 of code + phone + secret). Test numbers +9100000000xx get 000000 only when ALLOW_TEST_OTP is true.
   - POST /auth/otp/verify { phone, code, device: { platform, model, appVersion } } – constant-time compare; wrong code → 401 OTP_INVALID with details.attemptsLeft; after OTP_MAX_ATTEMPTS the challenge is burnt and auth.otp_locked is audited; expired → 401 OTP_EXPIRED. On success: create the user if new (status active, timezone from device if sent, else Asia/Kolkata), create a session, return { accessToken, refreshToken, user, isNewUser }. Audit auth.login.
2. Tokens (services/tokens.ts): access JWT { sub, role, sid } with JWT_ACCESS_EXPIRES_IN; refresh token = 64 random bytes base64url, only its SHA-256 stored on the session.
3. POST /auth/refresh { refreshToken } – rotation on every call, sliding expiry REFRESH_TOKEN_TTL_DAYS. A rotated token reused within 10 s returns the same new pair (grace for retries); after that, reuse revokes the whole session family (reason reuse_detected), audits auth.refresh_reuse and returns 401 REFRESH_INVALID.
4. POST /auth/logout (revokes the current family), POST /auth/logout-all, GET /auth/sessions (current one marked), DELETE /auth/sessions/:id (own only; others → 404). Audit each.
5. Users with status blocked or deletion_pending cannot verify or refresh (401 ACCOUNT_INACTIVE).
6. Tests: full OTP flow; wrong code and attempts; expiry (fake timers); resend and hourly limits; enumeration-safe responses; refresh rotation, grace window and reuse → family revoked; logout and logout-all; another user's session → 404; inactive users; test numbers refused when ALLOW_TEST_OTP=false; no token, code or phone in any log line (extend logging.test.ts).

Run lint, typecheck and tests. Commit: "feat(auth): add phone otp sign-in, tokens and sessions".
```

**Check after**
- [ ] `npm test` passes
- [ ] With the API running, request an OTP for your own number with `SMS_TRANSPORT=console` and see a masked line in the server log

---

## Prompt 4: Google and Apple, guards, ownership, /me and admin login

```
Build step 3 of Phase 1. Spec §2.2, §7.3–7.4, §11.1.

1. POST /auth/oauth/google { idToken, device } – verify with google-auth-library against GOOGLE_CLIENT_IDS (iOS, Android and web client ids). POST /auth/oauth/apple { identityToken, nonce, name?, device } – verify Apple's JWT (issuer, audience = APPLE_BUNDLE_ID, expiry, hashed nonce). Find the user by authProviders { provider, subject }, else by verified email, else create. Same response as OTP verify. Mock verification in tests.
2. middlewares/authenticate.ts – verifies the JWT, then loads the session (must be live) and the user (must be active) on every request so revocation is immediate; sets req.user = { id, role, sessionId, timezone }. 401 UNAUTHORIZED / ACCOUNT_INACTIVE otherwise. middlewares/authorize.ts – authorize(...roles) → 403 FORBIDDEN.
3. policies/ownership.ts – ownedFilter(user, extra?) returns { user: user.id, ...extra }; assertOwned(doc, user) throws 404 NOT_FOUND and audits access.denied (ids only). Unit tests.
4. GET /me and PATCH /me (name, timezone, hoursPerMonth 40–400, monthlyIncomePaise, favouriteStores, settings, consent) with a serializer; POST /me/onboarding/complete. Audit user.update_profile with field names only.
5. Admin login: POST /admin/auth/login { email, password, totp } – bcrypt (12 rounds), otplib TOTP, 5 failures → 15-minute lock (lastFailedLoginAt, failedLoginCount), enumeration-safe errors, audit auth.login / auth.login_failed. Returns the same token pair (role admin). Admins can't use OTP or OAuth.
6. tests/routeInventory.test.ts – lists every mounted route (from the Express router stack); every route except those in PUBLIC must return 401 without a token. PUBLIC for now: GET /health, POST /auth/otp/request, /auth/otp/verify, /auth/oauth/google, /auth/oauth/apple, /auth/refresh, /admin/auth/login.
7. tests/helpers/auth.ts – loginAs(phone | 'admin') returns { token, user, agent }, createUser(), resetDb(). Use them from now on.
8. Tests: OAuth new user, existing user, provider linking; authenticate with revoked session, blocked user; authorize; /me; admin lockout; route inventory; no secret fields in any auth response (sweep every auth endpoint's body for passwordHash, totpSecret, codeHash, refreshTokenHash).

Run lint, typecheck and tests. Commit: "feat(auth): add oauth, guards, ownership policy, me and admin login".
```

**Check after**
- [ ] `npm test` passes, including `routeInventory.test.ts`

---

## Prompt 5: Seed users and smoke checks

```
Build step 4 of Phase 1: seed and smoke. Spec §15.3, §15.5.

1. Seeders in server/src/seed/ (one file per data type, idempotent upserts through the services, fixed ids):
   - users.seed.ts: Asha (+910000000001, name Asha Rao, income ₹1,00,000 in profile, 176 h), Ravi (+910000000002, no income), admin (admin@allinone.test, password Password@123, a fixed TOTP secret – print the current TOTP code and an otpauth URL at the end of the seed, dev only).
   - npm run seed prints a login table: who, how to log in, OTP/password.
2. Smoke checks in server/smoke/checks/phase1.ts:
   - OTP request + verify for Asha and Ravi with 000000; GET /me returns the right name
   - refresh rotates; the old refresh token reused after 10 s → 401 (use a short wait or a test hook)
   - GET /me without a token → 401; with Ravi's token, DELETE Asha's session id → 404
   - admin login with the printed TOTP works (generate it in the smoke script from the seed secret)
   - logout makes the access token fail on the next request
   - audit chain verifies (call the service directly or an internal check)
3. tests/seed.users.test.ts: running the seed twice gives the same documents.

Run npm run seed -- --reset, npm run smoke and npm test, and show me the output. Commit: "feat(seed): add phase 1 users and smoke checks".
```

**Check after**
- [ ] `npm run seed -- --reset` prints the login table
- [ ] `npm run smoke` shows ✓ for every Phase 0 and Phase 1 check

---

## Prompt 6: Mobile – development build and sign-in

```
Build step 5 of Phase 1: the mobile auth flow. Spec §3.5, §13.1–13.3.

1. Development build: add expo-dev-client, eas.json (development, preview, production profiles), app.config.ts (name ALLinONEcart, scheme allinonecart, iOS bundleIdentifier and Android package com.allinonecart.app, plugins for secure store, Apple sign-in and Google sign-in). Tell me exactly which commands I run to build and install the development build on my phone (EAS cloud build or local build), and what I must create by hand (Apple developer team, Google OAuth client ids).
2. src/features/auth/: authSlice (user, accessToken in memory, status), tokenStorage.ts (refresh token in expo-secure-store only), and the RTK Query base query upgrade: attach the access token; on 401 run ONE refresh at a time (a shared mutex), retry the original request once; on refresh failure clear the session and go to sign-in. Restore the session on app start from SecureStore before hiding the splash screen.
3. Screens (Expo Router):
   - app/(auth)/phone.tsx – phone input with +91 prefix, Continue → OTP request; Continue with Google; Continue with Apple (iOS only); terms/privacy line.
   - app/(auth)/otp.tsx – 6-digit input with auto-fill (iOS one-time code, Android SMS retriever if simple), resend countdown, attempts left, clear error messages from the error codes.
   - app/(tabs)/_layout.tsx – tabs Home, Cart, Goals, Profile with placeholder screens (Cart and Goals are separate sections – spec D6; Home keeps the health card for now in dev builds only).
   - app/(tabs)/profile.tsx – name, phone/email, Sessions, Log out; app/settings/sessions.tsx – list with "This device", revoke others, log out everywhere.
   - Route guard in app/_layout.tsx: signed out → (auth); signed in and onboarding not complete → (tabs) for now (onboarding screens come in Phase 3).
4. Send device { platform, model, appVersion } with sign-in (expo-device, expo-application).
5. Tests (jest-expo + RNTL): phone validation, OTP screen states (wrong code shows attempts left, resend countdown), base query refresh mutex (two parallel 401s cause one refresh), session restore, logout clears SecureStore.
6. Maestro: set up mobile/e2e/ and add "npm run e2e:mobile". Flow 001_login.yaml: sign in as Asha with 000000 and see the tabs; 002_logout.yaml.

Run lint, typecheck and tests. Commit: "feat(mobile): add sign-in, sessions and tab shell".
```

**Check after**
- [ ] The development build is installed on your phone
- [ ] Sign in as Asha (`+91 00000 00001`, OTP `000000`), close the app completely and reopen it. You're still signed in.
- [ ] Sessions shows this device; "Log out everywhere" signs you out
- [ ] Google sign-in works (and Apple on iOS) once you've created the OAuth client ids
- [ ] `npm run e2e:mobile` passes on a simulator or your phone

---

## Prompt 7: Security review and finish Phase 1

```
Final step of Phase 1.

1. Security review against spec §11.1, §11.4 and §11.6. Check and report each with evidence (test name or command output):
   - no token, OTP, phone, password or hash in any response body or log line during a full auth flow
   - every non-public route returns 401 without a token (route inventory)
   - another user's records return 404 and are audited as access.denied
   - OTP and admin login limits are mounted and work (live check with the running API: 6th OTP request in an hour → 429)
   - refresh reuse revokes the family
   - the audit log rejects every update/delete path and the chain verifies
   - the mobile app stores nothing sensitive outside SecureStore (search the code for AsyncStorage and localStorage)
   Fix anything that fails.
2. Go through the Phase 1 checklist and "Done when" in docs/ROADMAP.md and verify each item. Run lint, typecheck, npm test, npm run seed -- --reset, npm run smoke and npm run e2e:mobile.
3. Update docs/ROADMAP.md: tick items, Phase 1 ✅ Done, Phase 2 🟡 In progress, decisions under "Notes / decisions" (and spec §20 "Decisions made" for any spec divergence).
4. Update CLAUDE.md: "Current phase" → Phase 2 with its spec sections; Commands (seed login table, e2e:mobile, dev build steps); add "Phase 1 building blocks (reuse, don't reinvent)": authenticate/authorize usage example, req.user shape, ownedFilter/assertOwned, audit.record usage example and the rule to add new actions to AUDIT_ACTIONS, PUBLIC list in routeInventory.test.ts, test helpers loginAs/createUser/resetDb, smoke check file per phase, mobile base query + refresh mutex, tokenStorage, route guard.
5. Commit: "docs: complete phase 1".
6. Short summary: what was built, what I must do by hand (OAuth ids, SMS provider account), and anything to flag before Phase 2.
```

**Check after**
- [ ] All checks green; `CLAUDE.md` has the Phase 1 building blocks
- [ ] Run `/clear` before starting Phase 2
