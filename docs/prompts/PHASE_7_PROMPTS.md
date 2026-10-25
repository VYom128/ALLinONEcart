# ALLinONEcart – Phase 7 prompts: Exact-match price comparison (V2)

**Goal:** for every cart item, show where the **exact same product** (same model and variant) is sold, lowest price first. A missing store is acceptable; a wrong match is not.
**Spec:** §4.8, §5.2–5.3, §6.16, §7.11, §10

Start only after the MVP gate is met. Start a fresh session (`/clear`) and update `CLAUDE.md` "Current phase" to Phase 7 first (or let Prompt 1 do it).

---

## Prompt 1: Read and plan (no code)

```
We are starting Phase 7 of ALLinONEcart: exact-match price comparison. Set "Current phase" in CLAUDE.md to Phase 7 (spec §4.8, §5.2–5.3, §6.16, §7.11, §10) and docs/ROADMAP.md Phase 7 to 🟡, then commit "docs: start phase 7".

Read:
- CLAUDE.md (all building blocks)
- docs/ROADMAP.md (Phase 7)
- docs/PROJECT_SPEC.md §4.8, §5.2–5.3, §6.16, §7.11, §10

Do NOT write code yet. Give me:
1. New models, modules, jobs, config files and mobile screens.
2. The fingerprint format and the normalisation rules with 10 worked examples (including the iPhone 18 256 GB Black on Apple, Croma, Flipkart and Amazon, a refurbished listing, a 128 GB listing, a "Pro" model, an international version, and two colour names that are the same colour).
3. Candidate sources: Amazon PA-API and Flipkart Affiliate API (what they return, rate limits, what I must sign up for) and which stores need search() adapters; how mockstores serves search pages for tests.
4. The scoring rules exactly as code will apply them, and how precision is measured on the labelled set.
5. How a MatchGroup is created, reused and refreshed, and how cart_items.comparison.status moves (spec §5.2).
6. Seed additions and the golden comparison result.
7. Build order matching the next prompts, and anything unclear.

Wait for my approval before building.
```

---

## Prompt 2: Models, fingerprints and the labelled match set

```
Build step 1 of Phase 7. Spec §5.2–5.3, §6.16, §10.1, §10.3, §10.6.

1. Models: match_groups, match_reports (spec §6.16); cart_items.comparison { status, updatedAt } (pending for new cart items once the feature flag is on, not_applicable while it's off; goals never have comparison); products.matchGroup. COMPARISON_STATUSES and MATCH_REPORT_STATUSES in shared enums with state machines.
2. config/matching/: units.ts, fillerWords.ts, colourSynonyms.ts (per brand), modelAliases.json and exclusions.json (admin-editable later). modules/comparison/fingerprint.ts – normalise(product) → { brand, model, storage, size, colour, condition, region } and fingerprint string; isExcluded(title) for refurbished/renewed/used/pre-owned/open-box/international.
3. tests/fixtures/matching/pairs.json – at least 60 labelled pairs { a, b, match: true|false, why } covering phones, laptops, headphones, TVs, shoes, branded clothing; include tricky non-matches (128 vs 256 GB, Pro vs non-Pro, Plus, colour variants, refurbished, international, bundles with a case, different sizes).
4. modules/comparison/score.ts – scoreMatch(a, b) → { match: boolean, confidence: 1 | 0.9 | 0, reason } per spec §10.2 step 6.
5. tests/matching.precision.test.ts – runs every pair; fails if precision < 99 %; prints precision and recall.
6. Feature flag: settings.comparison.enabled (server config) so the job and endpoints can be switched off.

Run lint, typecheck, tests and show me precision and recall. Commit: "feat(compare): add match models, fingerprints and labelled match set".
```

---

## Prompt 3: Candidate sources and search adapters

```
Build step 2 of Phase 7. Spec §10.2 step 4.

1. services/sources/amazonPaapi.ts and flipkartAffiliate.ts behind a CandidateSource interface (search({ brand, model, variant, gtin }) → Candidate[] with url, title, price, availability, identifiers). Env vars added (AMAZON_PAAPI_*, FLIPKART_AFFILIATE_*); disabled when missing. Responses mocked in tests from recorded JSON fixtures.
2. search() in adapters for Croma, Reliance Digital, Vijay Sales, Tata CLiQ, Myntra, Ajio and brand sites you planned: build the search URL, fetch with safeFetch (or browserFetch), parse the result list, return top N candidates. Add these stores to the stores seed with supportsComparison true.
3. mockstores: search result pages per store at /search/<store>?q=… and product pages for the candidates (fixtures with expected JSON).
4. Per-store rate limits honoured through the queue limiter; a source failing never fails the whole search.
5. Tests: each source/adapter search against fixtures; a failing source is skipped; rate limiter config.

Run lint, typecheck, tests. Commit: "feat(compare): add candidate sources and search adapters".
```

---

## Prompt 4: Matching job, offers API and the seeded iPhone

```
Build step 3 of Phase 7. Spec §7.11, §10.2, §10.4.

1. jobs/findExactMatches.job.ts – for a product: reuse a fresh MatchGroup (by product or fingerprint); else gather candidates from all sources, extract each with the normal pipeline, score, upsert accepted Products into the group (one per store, best confidence), set comparison.status on every active cart item pointing at any product in the group (ready / none / failed), and notify comparison_ready once per cart item when another store is cheaper (dedupeKey comparison_ready:<cartItemId>; text without names or prices). Enqueued after POST /cart and by a "stale" check.
2. GET /cart/:id/offers → { status, savedStore, offers: [{ productId, store, pricePaise, differencePaise, inStock, delivery?, seller?, lastCheckedAt, isLowest }] } lowest first, out of stock last; prices > 40 % below the group median hidden (flag for admin review); status none → "only sold on" data.
3. POST /cart/:id/offers/refresh (once per 15 min per cart item → 429), POST /cart/:id/switch-store { productId } (must be in the item's group; moves the item to that store's cart; updates product, pricePaise, image if the user hasn't set one; invalidates dashboard).
4. Add comparison_ready to NOTIFICATION_TYPES/config.
5. Seed: iPhone 18 256 GB Black fixtures on Apple (₹1,40,000), Croma (₹1,30,000), Flipkart (₹1,40,000), Amazon (₹1,60,000), plus a refurbished listing and a 128 GB listing that must not match; Asha saves it from Apple. Add the golden offers to expectations.json.
6. Tests: the golden offers exactly; refurbished/128 GB never present; a Zara item → none; outlier hiding; switch store updates totals; other user's cart item → 404; refresh limit; job idempotent; flag off → offers status not_applicable.
7. Smoke (phase7.ts): run the job for the seeded iPhone and compare with expectations.json.

Run lint, typecheck, tests, seed --reset and smoke. Commit: "feat(compare): add matching job, offers api and seeded golden comparison".
```

---

## Prompt 5: Wrong-match reports and admin review

```
Build step 4 of Phase 7. Spec §5.3, §10.6.

1. POST /cart/:id/match-reports { productId, reason } – hides that offer for this user at once (hiddenOffers on the cart item), creates a report (open).
2. Admin: GET /admin/match-reports (filters), POST /admin/match-reports/:id/confirm (remove the product from the group, add an exclusion rule pair to config/matching via a matching_rules collection the scorer reads, re-run the job for the group; audit admin.match_review) and /dismiss.
3. Admin panel: Match reports page (both products side by side: titles, variants, identifiers, prices), Matching rules page (aliases and exclusions), and outlier review (hidden low prices).
4. Tests: report hides only for the reporter; confirm removes and prevents re-matching; dismiss keeps it; admin RBAC.

Run lint, typecheck, tests. Commit: "feat(compare): add wrong-match reports and admin review".
```

---

## Prompt 6: Mobile comparison UI

```
Build step 5 of Phase 7. Mobile. Spec §4.8, §10.4.

1. Cart item detail: "Same product on other stores" section – loading (pending) state, offers list (store logo, price, difference "₹10,000 less"/"₹20,000 more", stock, delivery, seller, "Lowest price" badge), out-of-stock rows greyed at the bottom, "Last checked 2 h ago" with refresh, "Only sold on Zara" state, failed state with retry.
2. Each offer: Buy (opens that store), Switch to this store (confirm; the item moves to that store's cart and totals update), "Not the same product?" (report with reason).
3. CartItemCard badge "Cheaper on 2 stores" when status ready and a lower offer exists (from the server's offers summary on the card view – add it to the card serializer).
4. Deep link from the comparison_ready notification to the comparison section.
5. Tests: all states, switch and report flows. Maestro 008_compare.yaml with the seeded iPhone.

Run lint, typecheck, tests and e2e. Commit: "feat(mobile): add price comparison".
```

---

## Prompt 7: Finish Phase 7

```
Final step of Phase 7.

1. Verify the Phase 7 checklist and "Done when". Run lint, typecheck, all tests (precision ≥ 99 %), seed --reset, smoke, e2e.
2. Live check: run comparison for 10 real electronics URLs (a small script like adapters:live, not in CI) and list each result with the stores found; flag any match that looks wrong.
3. Update docs/ROADMAP.md (Phase 7 ✅, Phase 8 🟡), spec §20, and CLAUDE.md (Current phase → Phase 8; "Phase 7 building blocks": fingerprint/normalise/score, matching config and rules collection, CandidateSource interface, search() in adapters, findExactMatches job, offers serializer, comparison feature flag, precision test – never lower its threshold).
4. Commit: "docs: complete phase 7".
5. Summary and anything to flag.
```
