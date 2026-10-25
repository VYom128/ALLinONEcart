# ALLinONEcart – Phase 4 prompts: Goals and motivation

**Goal:** a separate **Goals** section for big targets (house, Porsche, BMW, trips) with savings, hours of work, a vision board and an achieved wall, plus a Home screen with a Cart card and a Goals card side by side. Goals never mix with the Cart: no moving items between them and no combined totals.
**Spec:** §4.3, §4.5–4.6, §4.8–4.9, §5.1 (goal), §6.9 (`goals`), §6.10–6.11, §7.5 (uploads), §7.7a, §7.8, §8.2–8.5, §14 and decision D6

Start a fresh session (`/clear`).

---

## Prompt 1: Read and plan (no code)

```
We are starting Phase 4 of ALLinONEcart: the Goals section and motivation.

Read these first:
- CLAUDE.md (building blocks of Phases 0–3, and the rule that Cart and Goals are separate sections)
- docs/ROADMAP.md (Phase 4)
- docs/PROJECT_SPEC.md §4.3, §4.5–4.6, §4.8–4.9, §5.1 (goal machine), §6.9 (goals), §6.10–6.11, §7.5, §7.7a, §7.8, §8.2–8.5, §14, §20 D6

Do NOT write code yet. Give me:
1. New server modules (goals, uploads, income, contributions, dashboard) and mobile screens.
2. New packages and why (e.g. expo-image-picker, expo-image-manipulator, a confetti/celebration library, expo-haptics).
3. How contributions keep goals.savedPaise and the goal status correct inside one transaction (add, delete, last one deleted).
4. The hours-of-work algorithm with three worked examples using Asha's seed goals, covering each display range.
5. The dashboard design: cartMetrics() and goalMetrics() as separate functions, the response shape { cart, goals }, the Redis cache key and invalidation. Confirm no combined total exists anywhere.
6. The seed goals, income and contributions for Asha and Ravi, and the "goals" block of expectations.json you'll compute by hand.
7. Build order matching the next prompts, and anything unclear.

Wait for my approval before building.
```

---

## Prompt 2: Goal model, uploads and goals API

```
Build step 1 of Phase 4. Server. Spec §5.1 (goal), §6.9 (goals), §7.5, §7.7a, §8.5.

1. modules/goals/model.ts – Goal per spec §6.9 (goals) with indexes; category must have section 'goal'; photo.storageKey select:false; referenceUrl validated as http(s) and never fetched by the server.
2. modules/goals/status.service.ts – applyGoalTransition(goal, to, { session, extra }) with the goal machine (conditional update, statusHistory, 409 CONFLICT on a lost race).
3. modules/uploads: POST /uploads { purpose: 'goal_photo' | 'achieved_photo', contentType, size } → { uploadId, putUrl, expiresAt }; an uploads record (user, key, purpose, status, expiresAt). When a goal uses an uploadId, the server reads the first bytes, checks the type by magic bytes (JPEG, PNG, WebP, HEIC) and size ≤ MAX_UPLOAD_MB, makes a WebP + 400 px thumbnail, and marks it used. Wrong type → 415; too big → 413.
4. Goals API (spec §7.7a): POST /goals, GET /goals (filters status (default active/saving), horizon, category, q; sort newest | target_asc | target_desc | priority | closest; cursor; meta.totals), GET /goals/groups?by=horizon|category (count, totalPaise, savedPaise), GET/PATCH/DELETE /goals/:id (delete removes its contributions in one transaction), POST /goals/:id/drop and /restore. Cap 100 active goals (ITEM_LIMIT_REACHED, details.section 'goal').
5. config/suggestions.ts: goal horizon from target price and goal category from title keywords (spec §8.5) + GET /goals/suggest?title=&targetPaise= for the app; table tests.
6. Categories: deleting a custom goal category moves its goals to the goal "other" category.
7. Tests: CRUD, filters, sorts, cursor, groups, cart-section category rejected, other user's goal → 404 everywhere, upload checks, goal machine table, limits.

Run lint, typecheck, tests. Commit: "feat(goals): add goal model, uploads and goals api".
```

---

## Prompt 3: Income, contributions and hours of work

```
Build step 2 of Phase 4. Server. Spec §6.10–6.11, §8.3.

1. modules/income: model (unique { user, month }), GET /income, POST /income { month 'YYYY-MM', amountPaise, source, note? } upserting by month (future months → 422), DELETE /income/:month.
2. modules/contributions (goals only): GET /goals/:id/contributions, POST /goals/:id/contributions { amountPaise > 0, date?, note? }, DELETE /contributions/:id. One transaction: write/delete, $inc goals.savedPaise, move active → saving on the first and saving → active when the last is removed (applyGoalTransition with the session). Only active/saving goals accept contributions (else 422). Limit 1,000 per goal.
3. utils/hoursOfWork.ts – pure function per spec §8.3: { remainingPaise, monthlyIncomePaise | null, hoursPerMonth } → null or { hours, unit, value (1 decimal), label }. Tests for every range boundary, zero/negative remaining, no income, very large targets.
4. services/income.ts – currentMonthlyIncome(user).
5. Add hoursOfWork and progress { savedPaise, remainingPaise, percent } to the goal detail and card serializers. (Cart items never get hours of work.)
6. Tests: income CRUD and ownership; contributions transaction (savedPaise and status always consistent, including a concurrent add + delete race); contributions on dropped/achieved goals → 422; other user's goal → 404; hours of work table tests.

Run lint, typecheck, tests. Commit: "feat(goals): add income, contributions and hours of work".
```

---

## Prompt 4: Dashboard, achieve, vision board, achieved wall, seed and golden numbers

```
Build step 3 of Phase 4. Server. Spec §5.1 (goal), §7.8, §8.2, §8.4, §14.

1. modules/dashboard/metrics.ts – the only place these numbers are computed, as two separate functions: cartMetrics(user) (total, count, byStore top stores, bought this month/year, recent) and goalMetrics(user) (total, byHorizon, saved, achieved all-time/this-year, nextMilestone per §8.4, hoursOfWork for total remaining, recent). monthSummary { cart: { added, bought }, goals: { contributedPaise, achieved } }.
2. GET /dashboard → { cart, goals, monthSummary } – no field adds Cart and Goals together (add a test that fails if the response has any combined total key). Cached in Redis per user for 60 s; invalidateDashboard(userId) after every cart, goal, income or contribution commit (add the calls to the Phase 3 cart writes too).
3. POST /goals/:id/achieve { paidPaise, at?, uploadId? } and /unachieve (within 7 days) via applyGoalTransition.
4. GET /goals/achieved (newest first, cursor) and GET /goals/vision-board (active goals' image, title and id only – no prices, no why), ordered by horizon then priority.
5. Seed (goals.seed.ts, income.seed.ts): Asha's goals "Porsche 911" (life), "3BHK apartment" (life), "BMW M340i" (big), "Bali trip" (this year), "MacBook Pro" (this year), 1 achieved and 1 dropped as planned, contributions toward 2 goals, income for the last 3 months; Ravi's 1 goal and no income. Write the "goals" block of expectations.json by hand: totals per horizon and category, saved, achieved all-time and this year, next milestone id and remaining, hours of work for 3 named goals and the total. Show the calculations.
6. Tests: tests/goals.golden.test.ts and tests/dashboard.golden.test.ts compare /goals/groups and /dashboard for Asha and Ravi with both blocks of expectations.json (Ravi's goals.hoursOfWork null); cache invalidation after a contribution and after a cart change; achieve/unachieve rules; vision board has no price fields; Cart endpoints never return goals and Goals endpoints never return cart items.
7. Smoke (phase4.ts): Asha's goals totals and dashboard equal the golden numbers; Ravi's hours of work is null; add a ₹1,000 contribution to a seeded goal → dashboard goals.savedPaise +100000 and cart numbers unchanged → delete it again.

Run lint, typecheck, tests, seed --reset and smoke. Commit: "feat(goals): add dashboard, achieve flow, vision board and seeded golden numbers".
```

**Check after**
- [ ] Check the hand calculations for the goals golden numbers
- [ ] `npm run smoke` passes and leaves the data unchanged

---

## Prompt 5: Mobile – Goals tab, new goal, savings and income

```
Build step 4 of Phase 4. Mobile. Spec §4.3, §4.5–4.6, §13.

1. Add the Goals tab: tabs are now Home, Cart, Goals, Profile.
2. Goals tab (app/(tabs)/goals.tsx): total of active goals, saved, next milestone at the top; segmented By horizon (This year / Big goals / Life goals) | By category; GoalCard (photo, title, target, progress bar, hours of work, target date); buttons for Vision board and Achieved wall; empty state ("What's one big thing you want to own?"). FlashList, cursor pagination, pull to refresh.
3. New goal (app/goals/new.tsx): title, target price (MoneyField), category (goal categories, suggested from the title), horizon (suggested from the price as you type), priority, target date, why, photo (expo-image-picker → resize → POST /uploads → PUT → uploadId), optional reference link (opens in the browser from goal detail; no price shown from it).
4. Goal detail (app/goals/[id].tsx): photo, title, target, progress, hours of work (or "Add your income to see this in hours"), target date, why, contributions list; actions Add savings (sheet: MoneyField, date, note), Edit, Drop / Restore, Delete, Open reference link. When remaining reaches 0: "You've saved enough! Mark as achieved?".
5. Income screen (app/income.tsx, from Profile and Goals): list by month, add/edit (month picker, MoneyField, source), delete.
6. Onboarding: add the first-goal step (title, target, optional photo; skippable) between income and the tutorial.
7. Tests: goal form validation and suggestions, Goals tab renders server groups and totals as given, add savings sheet, contributions delete, income form.

Run lint, typecheck, tests. Commit: "feat(mobile): add goals tab, new goal, savings and income".
```

---

## Prompt 6: Mobile – Home cards, vision board, achieve and achieved wall

```
Build step 5 of Phase 4. Mobile. Spec §4.8, §14.

1. Home (app/(tabs)/index.tsx): two separate cards, never a combined number.
   - Cart card: total in carts, item count, top 3 store carts (logo, count, total), bought this month; tap → Cart tab.
   - Goals card: total of goals, saved, next milestone with progress and "₹X to go", hours of work line; tap → Goals tab.
   - This month: Cart (added, bought) and Goals (saved, achieved) shown side by side.
   Loading skeletons, error state, pull to refresh. Move the dev health card to app/dev/health.tsx.
2. Vision board (app/goals/vision.tsx): full-screen photo grid of active goals (tile size by horizon), no prices; focus mode with slow auto-advance (respects reduce motion).
3. Achieve flow (app/goals/[id]/achieve.tsx): paid price (pre-filled with the target), date, optional photo → POST achieve → celebration (confetti + haptic, skippable, respects reduce motion) → Achieved wall. Undo within 7 days from goal detail.
4. Achieved wall (app/goals/achieved.tsx): newest first, photo, title, paid price, date; total achieved at the top.
5. Tests: Home shows two cards with server values as given (no client maths, no combined total), vision board has no price text, achieve form, achieved wall paging.
6. Maestro: 005_goals.yaml – create a goal with a photo → log income → add savings → see the Goals card on Home update while the Cart card stays the same → achieve → Achieved wall.

Run lint, typecheck, tests and e2e. Commit: "feat(mobile): add home cards, vision board, achieve flow and achieved wall".
```

**Check after**
- [ ] On your phone: Home shows a Cart card and a Goals card. Adding savings changes only the Goals card.
- [ ] Achieve a goal and see the celebration and the Achieved wall

---

## Prompt 7: Finish Phase 4

```
Final step of Phase 4.

1. Verify the Phase 4 checklist and "Done when". Run lint, typecheck, npm test, npm run seed -- --reset, npm run smoke and npm run e2e:mobile.
2. Separation check (spec D6): no endpoint, metric, serializer or screen mixes cart items and goals or adds their totals; cart and goals use separate categories and machines; search the code for any shared "item" model or conversion function and report.
3. Money check: integer paise everywhere (search server and mobile for parseFloat, toFixed and division on *Paise outside hoursOfWork and formatINR); no money values or titles in logs; every new endpoint has 401 and other-user-404 tests.
4. On the phone as Asha, compare Home, Cart and Goals with both blocks of expectations.json and report any difference.
5. Update docs/ROADMAP.md (Phase 4 ✅, Phase 5 🟡, notes) and spec §20.
6. Update CLAUDE.md: Current phase → Phase 5; "Phase 4 building blocks": goals module and applyGoalTransition, uploads flow, suggestions (goal horizon/category), contributions transaction, hoursOfWork, currentMonthlyIncome, dashboard cartMetrics/goalMetrics (the only place numbers are computed) + invalidateDashboard after commits, the no-combined-total test, mobile GoalCard, Home cards, celebration component.
7. Commit: "docs: complete phase 4".
8. Short summary and anything to flag before Phase 5.
```
