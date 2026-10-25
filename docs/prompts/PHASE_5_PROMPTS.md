# ALLinONEcart – Phase 5 prompts: Notifications, privacy and settings

**Goal:** push notifications with sensible limits, and the privacy features users expect before launch: encryption of money values, export, deletion, consent and app lock.
**Spec:** §4.7, §6.12–6.13, §7.4 (export/delete), §7.9, §8.10–8.11, §11.2, §11.5, §12

Start a fresh session (`/clear`).

---

## Prompt 1: Read and plan (no code)

```
We are starting Phase 5 of ALLinONEcart: notifications, privacy and settings.

Read these first:
- CLAUDE.md (building blocks of Phases 0–4)
- docs/ROADMAP.md (Phase 5)
- docs/PROJECT_SPEC.md §4.7, §6.12–6.13, §7.4, §7.9, §8.10–8.11, §11.2, §11.5, §12

Do NOT write code yet. Give me:
1. New server modules, jobs and mobile screens.
2. New packages and why (expo-server-sdk, expo-notifications, expo-local-authentication, any crypto helpers).
3. The notification service design: in-app record, dedupeKey, 3/day limit, quiet hours in the user's time zone, per-type switches, Expo push tickets and receipts, DeviceNotRegistered.
4. How monthly_checkin finds users whose local time is 10:00 on the 1st without scanning everyone every minute.
5. Field-level encryption: algorithm, key handling, which fields, how the existing seed and data are migrated, and how aggregations (dashboard) still work.
6. Export format, deletion flow and the purge job (what is deleted, what is kept anonymised, e.g. shared Products).
7. Build order matching the next prompts, and anything unclear.

Wait for my approval before building.
```

---

## Prompt 2: Devices, push and the notification service

```
Build step 1 of Phase 5. Server. Spec §6.12–6.13, §7.9, §8.10, §12.

1. shared enums: NOTIFICATION_TYPES (monthly_checkin, milestone_ready for now; spec §12 lists later ones) and NOTIFICATION_CONFIG per type (default on/off, link route, push yes/no).
2. modules/devices: POST /devices { expoPushToken, platform, appVersion } (upsert; a token moving to another user is reassigned), DELETE /devices/:token (own only).
3. services/push.ts – Expo push via expo-server-sdk (EXPO_ACCESS_TOKEN), chunking; a fake transport for tests that records messages.
4. services/notification.service.ts – notify({ userId, type, title, body, data, link, dedupeKey }):
   - data must pass an allow-list (ids, counts, month, status) – a test fails if titles, prices or free text slip in
   - unique { user, dedupeKey }: a repeat is a no-op
   - stores the in-app notification; decides push: type enabled in user settings, ≤ 3 pushes per user per local day, outside quiet hours (else heldUntil = end of quiet hours)
   - enqueues send_push; never throws (logs and continues)
5. jobs/sendPush.job.ts – sends to all live devices of the user, stores ticket ids; a delayed receipts check (15 min) disables tokens reported DeviceNotRegistered. jobs/releaseHeld.job.ts – every 5 min sends held notifications whose heldUntil passed (still respecting the daily limit).
6. GET /notifications (cursor), GET /notifications/unread-count, POST /notifications/:id/read, POST /notifications/read-all.
7. Settings: PATCH /me accepts settings.notifications per type and settings.quietHours { start, end }.
8. Tests (fake clock, fake push): dedupe, the 4th push in a day stays in-app, quiet hours hold and release, disabled type, allow-list rejection, token reassignment, DeviceNotRegistered disables a token, inbox paging and unread count, other user's notification → 404.

Run lint, typecheck, tests. Commit: "feat(notifications): add devices, push and notification service".
```

---

## Prompt 3: Monthly check-in and milestone notifications

```
Build step 2 of Phase 5. Server. Spec §4.7, §8.11, §12.

1. jobs/monthlyCheckin.job.ts – runs every 15 minutes; finds users whose local time is between 10:00 and 10:15 on the 1st of the month (group by timezone: compute which zones are in that window now, then query users in those zones); notify type monthly_checkin, dedupeKey monthly_checkin:<YYYY-MM>; title/body without amounts ("Log October's income to update your goals"); link /income.
2. milestone_ready (Goals only) – when a contribution makes remaining ≤ 0 for an active goal, notify once per goal (dedupeKey milestone_ready:<goalId>) with no goal title in the text ("You've saved enough for one of your goals"), link to the goal. Called after the transaction commits.
3. Monthly summary data: GET /dashboard monthSummary already exists; the check-in notification links to Home where it shows.
4. Tests with a fixed now: users in Asia/Kolkata and Europe/London get the check-in at their own 10:00 on the 1st, exactly once even if the job runs twice; milestone fires once and not for dropped goals.
5. Smoke (phase5.ts, part 1): run the check-in job function for Asha with a fixed now through a dev-only script hook (never exposed as a route in production) and see one notification in her inbox; mark it read.

Run lint, typecheck, tests, smoke. Commit: "feat(notifications): add monthly check-in and milestone notifications".
```

---

## Prompt 4: Encryption, export, deletion and consent

```
Build step 3 of Phase 5. Server. Spec §5.5, §7.4, §11.2, §11.5.

1. utils/fieldCrypto.ts – AES-256-GCM with ENCRYPTION_KEY (32 bytes base64; required outside test); stored as "v1:<iv>:<tag>:<ciphertext>" strings; a Mongoose helper so income_entries.amountPaise, contributions.amountPaise and users.monthlyIncomePaise are encrypted on write and decrypted on read (getters/setters or service-level, your choice – explain it). Key rotation ready via the version prefix.
2. Because aggregations can't sum ciphertext: goals.savedPaise stays plaintext (it's derived and needed for sorting and totals) – confirm this matches the spec or record a decision in §20; dashboard and income code decrypt in the service.
3. Migration script (npm run migrate:encrypt-money, idempotent, dry-run by default, --apply) that encrypts existing plaintext values. Re-run the seed through the services so seeded values are encrypted.
4. GET /me/export?format=json|csv – the user's profile, cart items, goals, income, contributions, categories, notifications (decrypted), with Cart and Goals as separate sections of the export, streamed; CSV as a zip of one file per collection or one multi-section file (choose and explain). Audit user.export. Rate limit 3/day.
5. POST /me/delete { confirm: 'DELETE' } → status deletion_pending, deletionRequestedAt, revoke all sessions, disable devices, audit user.delete_request. jobs/purgeDeletedAccounts.job.ts (daily): 30 days later delete the user's cart items, goals, income, contributions, categories, notifications, devices, sessions, uploads (storage objects too); decrement Product activeCartCount; replace the user document with a tombstone (no phone/email/name) and audit user.purged. Shared Products stay.
6. Consent: PATCH /me consent { termsAcceptedAt, privacyVersion, analytics }; sign-in returns whether the current privacy version needs accepting.
7. Tests: values in the raw collection are not readable numbers; dashboard numbers unchanged after encryption (golden test still passes); wrong key fails loudly; export contains all of Asha's data and none of Ravi's; deletion blocks login immediately; purge with a fixed now removes everything listed and leaves Ravi untouched; migration is idempotent.
8. Smoke (phase5.ts, part 2): export for Asha returns her cart item count and goal count from expectations.json.

Run lint, typecheck, tests, seed --reset and smoke. Commit: "feat(privacy): add field encryption, export, deletion and consent".
```

**Check after**
- [ ] Open MongoDB (Compass or mongosh) and check that `income_entries.amountPaise` is unreadable
- [ ] `npm run smoke` and the golden tests still pass

---

## Prompt 5: Mobile – notifications, settings and app lock

```
Build step 4 of Phase 5. Mobile. Spec §11.2, §12, §13.

1. Push: ask for permission at a good moment (after the first cart item or goal is saved, with a short explanation screen first), get the Expo push token, POST /devices; DELETE on logout. Handle taps (deep link to the notification's link) when the app is open, in the background or closed.
2. Inbox (app/notifications.tsx): list, unread dots, mark read on open, mark all read; bell with unread count on Home's header.
3. Settings:
   - settings/notifications.tsx – per-type switches and quiet hours
   - settings/privacy.tsx – consent (terms/privacy versions, analytics on/off), export (share sheet with the file), delete account (explain the 30 days, type DELETE to confirm, then sign out), grievance contact
   - settings/app-lock.tsx – turn on app lock (expo-local-authentication; fallback device passcode); lock after 60 s in the background; lock screen hides content and the app switcher snapshot
4. When the app lock is on, don't persist money values in any cache (spec §11.2); clear the persisted RTK Query cache on lock/logout.
5. Consent screen after sign-in when the server says a new privacy version needs accepting.
6. Tests: permission flow, deep link routing from a notification payload, inbox, settings forms, app lock timer logic.
7. Maestro: 007_settings.yaml – open inbox, change notification settings, export.

Run lint, typecheck, tests and e2e. Commit: "feat(mobile): add notifications, privacy settings and app lock".
```

**Check after**
- [ ] On your phone: run the check-in job for Asha (dev script) and receive the push; tapping it opens the Income screen
- [ ] App lock: background the app for over a minute and come back. Face ID or fingerprint is asked.
- [ ] Export shares a file you can open

---

## Prompt 6: Finish Phase 5

```
Final step of Phase 5.

1. Verify the Phase 5 checklist and "Done when". Run lint, typecheck, npm test, npm run seed -- --reset, npm run smoke and npm run e2e:mobile.
2. Privacy review: no titles, prices, income or notes in push titles/bodies, analytics, audit metadata or logs (search the code and run a full flow with log capture); encrypted fields unreadable at rest; export complete; deletion purge complete.
3. Update docs/ROADMAP.md (Phase 5 ✅, Phase 6 🟡, notes) and spec §20 (encryption decision, export format).
4. Update CLAUDE.md: Current phase → Phase 6; Commands (migrate:encrypt-money, dev job runner script); "Phase 5 building blocks": notify() (allow-listed data, dedupeKey, limits, quiet hours – the only way to notify), adding a notification type (enum + config + mobile route + test), fieldCrypto and which fields are encrypted, export and purge (add every new user-owned collection to both!), consent versioning, mobile push registration, deep links, app lock and cache rule.
5. Commit: "docs: complete phase 5".
6. Short summary and anything to flag before Phase 6.
```
