# ALLinONEcart – Phase 9 prompts: Affiliate links and Premium (V2)

**Goal:** earn from Buy clicks through affiliate links, and offer an optional Premium plan with clear free-plan limits.
**Spec:** §6.6 (affiliate), §6.16 (affiliate_clicks), §7.12, §8.8, §11.5, §14 (monetisation in the documentation)

Start a fresh session (`/clear`).

---

## Prompt 1: Read and plan (no code)

```
We are starting Phase 9 of ALLinONEcart: affiliate links and Premium. Make sure CLAUDE.md and the roadmap say Phase 9 (commit "docs: start phase 9" if you change them).

Read: CLAUDE.md, docs/ROADMAP.md (Phase 9), docs/PROJECT_SPEC.md §6.6, §6.16, §7.12, §8.8, §11.5.

Do NOT write code yet. Give me:
1. Affiliate design: per-store config (Amazon Associates tag, Flipkart affiliate id, a network like Cuelinks/EarnKaro for others), URL building in adapters, the /go redirect, click records, disclosure text, and what I must sign up for.
2. Premium design with RevenueCat: products (monthly, yearly), entitlement "premium", webhook → users.plan, restore purchases, grace periods, and what I must set up in App Store Connect, Play Console and RevenueCat.
3. The free vs Premium limits table (50 active cart items, 20 active goals, 3 alerts, 30 days of price history; Premium unlimited, projections, wallpapers, themes, hide amounts) and every server check that enforces it.
4. Spec changes needed (add a §8.12 Plans and limits section and the plan state machine) – write them as a diff proposal.
5. Build order and anything unclear.

Wait for my approval. After approval, first update the spec with the agreed sections and commit "docs(spec): add plans and affiliate details".
```

---

## Prompt 2: Affiliate links

```
Build step 1 of Phase 9.

1. Store affiliate config (select:false) + admin panel editing; adapters implement affiliateUrl(url, config) (Amazon tag param, Flipkart affid, network deep-link template for others); unit tests per store.
2. GET /go/:productId (authenticated; product must belong to one of the user's cart items or their offers) → 302 to the affiliate URL, records affiliate_clicks { user, cartItem, product, store, at }; falls back to the plain URL when no config. GET /cart/:id/buy-link now returns the /go URL; the mobile Buy flow follows it.
3. Admin: affiliate clicks report (per store per day, CSV export).
4. Mobile: a short disclosure line near Buy buttons ("We may earn a commission – it doesn't change your price") and in settings/privacy.
5. Analytics: buy_clicked already exists – add storeKey only.
6. Tests: URL building per store, /go ownership (404 for others), click recorded, fallback, admin report.

Run lint, typecheck, tests, smoke. Commit: "feat(revenue): add affiliate links and click tracking".
```

---

## Prompt 3: Premium plan

```
Build step 2 of Phase 9.

1. RevenueCat on mobile (react-native-purchases): paywall screen (benefits list, monthly/yearly prices from the store, restore purchases, terms/privacy links); entitlement check through the server, not only the SDK.
2. Server: POST /webhooks/revenuecat (shared-secret auth, idempotent by event id; added to PUBLIC in route inventory) updates users.plan and planExpiresAt; GET /me includes plan.
3. utils/plan.ts – limitsFor(user) and assertWithinLimit(user, 'activeCartItems' | 'activeGoals' | 'alerts' | 'priceHistoryDays'); enforced in cart create/restore/unbuy, goal create/restore/unachieve, alerts create, price history range. Over the limit → 422 ITEM_LIMIT_REACHED (or a new PLAN_LIMIT_REACHED code added to §16) with details { limit, plan }. Existing users over the limit keep their cart items and goals; only new ones are blocked.
4. Mobile: limit errors open the paywall with context; Profile shows the plan and "Manage subscription".
5. Tests: webhook events (initial purchase, renewal, cancellation, expiration, billing issue grace), limits per plan, downgrade keeps data, mobile paywall states with a mocked SDK.

Run lint, typecheck, tests, smoke, e2e. Commit: "feat(revenue): add premium plan and limits".
```

**Check after**
- [ ] A sandbox purchase on your phone switches you to Premium; cancelling in sandbox switches back after expiry
- [ ] Buy links open with your affiliate tag (check the URL)

---

## Prompt 4: Finish Phase 9

```
Final step of Phase 9.

1. Verify the checklist. Run lint, typecheck, tests, seed --reset, smoke, e2e.
2. Store compliance check: Apple/Google rules for subscriptions (restore button, clear pricing, terms links) and affiliate disclosure – list each with where it is in the app.
3. Update docs/ROADMAP.md (Phase 9 ✅, Phase 10 🟡), spec §20, CLAUDE.md (Current phase → Phase 10; "Phase 9 building blocks": affiliateUrl in adapters, /go redirect (the only way to open a store), limitsFor/assertWithinLimit, RevenueCat webhook, paywall entry points).
4. Commit: "docs: complete phase 9". Summary and flags.
```
