# ALLinONEcart – Phase 8 prompts: Price tracking and alerts (V2)

**Goal:** prices stay fresh without wasting requests, and users hear about drops, restocks and target dates.
**Spec:** §5.4, §6.16 (price_history, alerts), §8.10–8.11, §10.5, §12

Start a fresh session (`/clear`).

---

## Prompt 1: Read and plan (no code)

```
We are starting Phase 8 of ALLinONEcart: price tracking and alerts. CLAUDE.md should say Phase 8 – if not, update it and the roadmap first and commit "docs: start phase 8".

Read: CLAUDE.md, docs/ROADMAP.md (Phase 8), docs/PROJECT_SPEC.md §5.4, §6.16, §8.10–8.11, §10.5, §12.

Do NOT write code yet. Give me:
1. New models, jobs, endpoints and mobile screens.
2. The scheduler: how nextCheckAt is set per spec §10.5, how the dispatcher picks due products without scanning everything, per-store limits, sale-season halving, and the expected number of requests per day for 10k active products.
3. Alert evaluation rules per type, re-arming, and dedupe keys.
4. How tests change mockstores prices during a test and use a fake clock.
5. Build order and anything unclear.

Wait for my approval before building.
```

---

## Prompt 2: Price history and the refresh scheduler

```
Build step 1 of Phase 8. Spec §6.16, §10.5.

1. price_history as a MongoDB time-series collection (timeField at, metaField product); written only when price or stock changes, plus one point per day for charts.
2. Products: nextCheckAt set from the interval table (price bands, ≥ 100 active cart items → 3 h, sale season halves it; config/refresh.ts with a sale calendar file); products with activeCartCount 0 get no nextCheckAt.
3. jobs/refreshDispatcher.job.ts (every minute): picks due products by nextCheckAt (index), claims each with a conditional update (so two workers never take the same one), enqueues refresh_price with the per-store limiter.
4. jobs/refreshPrice.job.ts: extract via the adapter, update price/stock/lastCheckedAt/nextCheckAt, write price history, then enqueue evaluate_alerts if price or stock changed; failures back off (nextCheckAt + 2 h, max 24 h) and log to extraction_logs.
5. GET /cart/:id/price-history?range=30d|90d|1y (points for the cart item's product; free plan limit comes in Phase 9).
6. mockstores: a test-only way to set a fixture's price and stock (POST /__set on mockstores, test env only).
7. Tests with a fake clock: intervals per band, claiming is exclusive, no checks for inactive products, history only on change + daily point, back-off.

Run lint, typecheck, tests. Commit: "feat(tracking): add price history and refresh scheduler".
```

---

## Prompt 3: Alerts and notifications

```
Build step 2 of Phase 8. Spec §5.4, §12.

1. alerts model and endpoints: GET /alerts, POST /alerts { cartItemId, type: price_below | back_in_stock | cheaper_elsewhere, thresholdPaise? } or { goalId, type: target_date }, PATCH /alerts/:id (threshold, enabled), DELETE /alerts/:id. Price types are Cart-only and target_date is Goals-only (wrong pairing → 422). Default alerts: cheaper_elsewhere on for new cart items; target_date on for goals with a targetDate.
2. jobs/evaluateAlerts.job.ts per product change: price_below fires when price ≤ threshold and re-arms when it goes back above; back_in_stock on false → true; cheaper_elsewhere when another store in the match group drops below the saved store's price; jobs/targetDate.job.ts daily for 30/7/1 days before targetDate. All through notify() with dedupeKey <type>:<alertId>:<version or date>; texts without names or prices.
3. Add price_drop, back_in_stock, target_date (and use comparison_ready) to NOTIFICATION_TYPES/config and settings.
4. Tests (fake clock + mockstores /__set): each alert fires exactly once, re-arming works, disabled alerts never fire, other user's alert → 404, notification limits still apply.
5. Smoke (phase8.ts): set a seeded product's price lower on mockstores, run refresh + evaluate for it, see one price_drop notification for Asha, reset the price.

Run lint, typecheck, tests, seed --reset and smoke. Commit: "feat(tracking): add alerts and price notifications".
```

---

## Prompt 4: Mobile – alerts and price history

```
Build step 3 of Phase 8. Mobile.

1. Cart item detail: price history chart (react-native-svg or victory-native; 30d/90d/1y tabs; current, lowest, highest labels; a text summary for screen readers), "Alert me" section (price below with MoneyField, back in stock, cheaper elsewhere) with switches. Goal detail: target-date reminder switch.
2. Settings → Notifications: new types with switches.
3. Deep links from each new notification type to the cart item or goal.
4. Tests for the chart's text summary and the alert toggles. Maestro 009_alerts.yaml.

Run lint, typecheck, tests and e2e. Commit: "feat(mobile): add price history and alerts".
```

---

## Prompt 5: Finish Phase 8

```
Final step of Phase 8.

1. Verify the checklist and "Done when". Run lint, typecheck, tests, seed --reset, smoke, e2e.
2. Load check: with seed:large, run the dispatcher for one simulated day with a fake clock and report the number of refreshes per store and the peak per minute versus each store's limit.
3. Update docs/ROADMAP.md (Phase 8 ✅, Phase 9 🟡), spec §20, CLAUDE.md (Current phase → Phase 9; "Phase 8 building blocks": nextCheckAt rules and config/refresh.ts, dispatcher claim pattern, refresh_price, price_history writes, alerts and evaluateAlerts, mockstores /__set for tests).
4. Commit: "docs: complete phase 8". Summary and flags.
```
