# ALLinONEcart – Phase 2 prompts: Stores, categories and product extraction

**Goal:** a product URL from any of the 10 MVP stores becomes a clean product preview. Tests never call real stores.
**Spec:** §6.6–6.8, §6.15, §7.5–7.6, §8.5–8.6, §8.11, §9, §11.3

Start a fresh session (`/clear`).

---

## Prompt 1: Read and plan (no code)

```
We are starting Phase 2 of ALLinONEcart: stores, categories and product extraction.

Read these first:
- CLAUDE.md (Phase 0 and 1 building blocks)
- docs/ROADMAP.md (Phase 2)
- docs/PROJECT_SPEC.md §6.6–6.8, §6.15, §7.5–7.6, §8.5–8.6, §8.11, §9, §11.3, §15.4

Do NOT write code yet. Give me:
1. New files and folders (server modules, adapters, jobs, services, mockstores fixtures).
2. New packages and why (cheerio, undici, playwright, sharp, @aws-sdk/client-s3 + s3-request-presigner, bullmq, file-type, ipaddr.js or similar).
3. New env vars.
4. The queue design: queue names, which process runs them, retries, per-store rate limiting, how tests run jobs without Redis.
5. The fetcher's SSRF protection: when DNS is resolved and checked, how redirects are checked, size/time limits.
6. The adapter interface and the parse order (JSON-LD → Open Graph → meta → adapter).
7. How mockstores fixtures are made and how MOCKSTORES_URL rewrites store hosts in dev/test.
8. Build order matching the next prompts, and anything unclear in the spec.

Wait for my approval before building.
```

---

## Prompt 2: Stores and categories

```
Build step 1 of Phase 2. Spec §6.6, §6.7, §7.5.

1. modules/stores: model (spec §6.6; affiliate select:false), serializer (public fields only), GET /stores (authenticated, active stores).
2. modules/categories: model (spec §6.7 – with section 'cart' | 'goal', unique { user, section, name } case-insensitive), GET /categories?section=cart|goal (built-ins + own, sorted), POST /categories { section, name, icon, colour } (max 30 own per section → 422 BUSINESS_RULE_VIOLATION), PATCH/DELETE /categories/:id (own only; built-ins → 403 FORBIDDEN; another user's → 404; section can't change). DELETE moves that section's cart items or goals to its "other" category – neither exists yet, so implement it in the service with TODO tests that Phases 3 and 4 complete.
3. Seeders: stores.seed.ts (the 10 MVP stores from spec §9.5 with keys, names, domains, logoUrl placeholders, needsBrowser false for now, plus an "unknown" store), categories.seed.ts (7 cart + 7 goal built-ins from spec §6.7 with lucide icon names and colour tokens).
4. Tests: per endpoint – success, validation, 401, other user's 404, limits; seed idempotent.
5. Smoke (smoke/checks/phase2.ts): GET /stores returns 10 + unknown with no private fields; Asha creates, renames and deletes a custom category.

Run lint, typecheck, tests, seed and smoke. Commit: "feat(catalog): add stores and categories".
```

---

## Prompt 3: Products, storage, queues and image caching

```
Build step 2 of Phase 2. Spec §6.8, §8.6, §8.11.

1. modules/products/model.ts – spec §6.8, unique { store, canonicalUrl }; images[].storageKey select:false; a serializer for user-facing product views.
2. services/storage: a StorageDriver interface (putObject, getSignedPutUrl, getSignedGetUrl or public URL, deleteObject) with an S3-compatible driver (MinIO locally, R2 later) and an in-memory driver for tests. Env: STORAGE_DRIVER, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, PUBLIC_ASSET_URL. Keys are random (no user input in keys).
3. jobs/queues.ts – BullMQ queue and worker factory; queue names as constants; default retries 3 with exponential backoff; removeOnComplete/removeOnFail limits; a per-store limiter helper using the store's rateLimitPerMinute. worker.ts registers processors. JOBS_ENABLED gates repeatable jobs. Each job exports runX(payload, deps) so tests call it directly.
4. jobs/cacheImages.job.ts – for a product: download each image through the safe fetcher (stub it for now; the real fetcher comes in the next prompt), check it's an image by magic bytes, store the original (max 2000 px, WebP) and a 400 px WebP thumbnail with sharp, save url/thumbUrl/storageKey. Idempotent: skips images already cached.
5. Tests: product model uniqueness, storage drivers (memory), cache_images with a fake image (stored + thumbnail; non-image rejected; second run does nothing), queue factory config.

Run lint, typecheck and tests. Commit: "feat(products): add product model, storage and image caching job".
```

---

## Prompt 4: Safe fetcher and URL normalisation

```
Build step 3 of Phase 2. Spec §9.2, §11.3.

1. services/fetcher.ts – safeFetch(url, { timeoutMs, maxBytes, accept }) :
   - only http/https; resolve DNS and refuse private, loopback, link-local, multicast, CGNAT and cloud metadata ranges (IPv4 and IPv6, including IPv4-mapped IPv6); re-check on every redirect (max 5, manual redirect handling); connect to the checked IP so DNS can't change in between
   - FETCH_TIMEOUT_MS (8000) and 5 MB max body (abort when exceeded)
   - fixed user agent and accept-language en-IN
   - in dev/test, MOCKSTORES_URL rewrites any known store host to the mockstores server (the only allowed localhost target, and only when NODE_ENV !== 'production')
   - returns { status, url (final), headers, body (string or Buffer) }
2. services/browserFetch.ts – Playwright Chromium (PLAYWRIGHT_ENABLED), one shared browser, a new context per page, blocks images/fonts/media, same SSRF checks on the main URL and on every request the page makes, same timeout. Only used when store.needsBrowser.
3. utils/url.ts – extractFirstUrl(text), normaliseUrl(url) per spec §9.2 (lower-case host, drop fragment, remove tracking params: utm_*, gclid, fbclid, ref, ref_, tag, affid, affExtParam*, srsltid, plus adapter lists), and findStoreForUrl(url, stores).
4. Wire cache_images to safeFetch.
5. Tests: SSRF table test (127.0.0.1, 10.x, 169.254.169.254, ::1, ::ffff:127.0.0.1, a hostname resolving to a private IP via a stubbed resolver, a redirect to a private IP) all refused with STORE_UNSUPPORTED; size and time limits; MOCKSTORES rewrite allowed in test and refused in production config; at least 20 real-looking Indian store URLs through extractFirstUrl/normaliseUrl (Amazon /dp/, Flipkart pid, Myntra, Zara with query params, shared text like "Check this out https://… via Myntra").

Run lint, typecheck and tests. Commit: "feat(extract): add safe fetcher and url normalisation".
```

---

## Prompt 5: Adapter interface, generic parser and mockstores fixtures

```
Build step 4 of Phase 2. Spec §9.3–9.4, §15.4.

1. adapters/types.ts – StoreAdapter and ExtractedProduct (title, brand, model, images, pricePaise, currency, inStock, availableVariants { sizes, colours, storage }, identifiers { gtin, mpn, sku }, variant, breadcrumb, method, partial). adapters/index.ts – registry by store key; generic fallback.
2. adapters/generic/ – parse with cheerio: JSON-LD schema.org Product (including @graph, arrays, offers as object or array, AggregateOffer lowPrice, priceCurrency, availability URLs), then Open Graph / product:price meta, then common meta. Prices parsed to paise without floats ("₹1,499.00", "1499", "Rs. 1,499"). Strings trimmed, markup stripped, length-limited.
3. mockstores: serve mockstores/stores/<store>/<name>.html; add /slow/<path> (waits 5 s) and /broken (500) and /notproduct (an HTML page with no product data). Add 3 generic fixtures: JSON-LD only, Open Graph only, neither.
4. Tests: the generic parser against each fixture (expected fields in a fixtures/<name>.expected.json next to each page); price parsing table test.

Run lint, typecheck and tests. Commit: "feat(extract): add adapter interface, generic parser and mockstores fixtures".
```

---

## Prompt 6: The 10 store adapters

```
Build step 5 of Phase 2. Spec §9.4–9.5.

For each MVP store (Amazon, Flipkart, Myntra, Ajio, Nykaa, Zara, H&M, Bear House, Snitch, The Souled Store):
1. adapters/<store>/index.ts – matches(), canonicalise() (e.g. Amazon → https://www.amazon.in/dp/<ASIN>; Flipkart keeps the pid query param; strip everything else), store-specific tracking params, and extract() that fills gaps on top of the generic parser (variants, sizes, colours, price when not in JSON-LD). Set needsBrowser only where a page has no usable data without JavaScript.
2. At least 2 fixture pages per store in mockstores/stores/<store>/ with *.expected.json. Base them on each store's real page structure (JSON-LD, meta tags, embedded state JSON where the store uses one). Add mockstores/README.md explaining how to refresh a fixture from a real page and that fixtures must contain no personal data.
3. Tests: one test file per adapter running every fixture against its expected JSON, plus canonicalise() cases.
4. scripts: "npm run adapters:live" (server) – reads adapters/live-urls.json (one real product URL per store, which I can edit), runs the real extraction (no MOCKSTORES), prints a table store | ok | method | title | price | ms | reason. Not part of npm test or CI.

Run lint, typecheck and tests, then run npm run adapters:live once and show me the table. Commit: "feat(extract): add store adapters for the 10 mvp stores".
```

**Check after**
- [ ] Every adapter's fixture tests pass
- [ ] Read the `adapters:live` table. Some real stores may fail (blocking, JavaScript-only pages); note which ones for later.

---

## Prompt 7: The /extract endpoint, suggestions and parser health

```
Build step 6 of Phase 2. Spec §7.6, §8.5–8.6, §9.3, §9.6, §6.15.

1. config/suggestions.ts – cart category rules (store default + keyword rules on title/breadcrumb, fallback other) per spec §8.5; pure functions with table tests. (Goal horizon and goal category suggestions come in Phase 4.)
2. modules/extract: POST /extract { url } (authenticated) per spec §9.3:
   - extractFirstUrl + normaliseUrl + findStoreForUrl (unknown → generic + "unknown" store)
   - existing Product checked < 6 h ago → return it without fetching
   - fetch within EXTRACT_BUDGET_MS (3000): plain fetch or browserFetch; parse with the adapter
   - upsert the Product, enqueue cache_images, write an extraction_logs row (spec §6.15, TTL 30 days, no page content, URL without query string)
   - timeout → 200 with partial: true (store, canonicalUrl, whatever was found) and enqueue extract_product (jobs/extractProduct.job.ts completes the Product later)
   - failure → 422 EXTRACT_FAILED with details.url; non-web URL or blocked host → 422 STORE_UNSUPPORTED
   - response preview per spec §7.6 with suggestedCategory (a cart category); never creates a cart item
   - limiter: 30 / 10 min per user
3. jobs/parserHealth.job.ts – hourly; success rate per store for the last 24 h from extraction_logs; logs a warning line per store under 90 % and stores the result (a small parser_health collection or Redis key) for the admin panel in Phase 6.
4. Tests (with startMockstores): every store's fixture via /extract; cache hit (no second fetch); slow page → partial within ~3.5 s and the retry job completes it; broken → EXTRACT_FAILED; notproduct → EXTRACT_FAILED; SSRF URL → STORE_UNSUPPORTED; limiter; parser health maths.
5. Smoke (phase2.ts): extract one fixture URL per store through MOCKSTORES_URL, check title and price > 0; the second call is a cache hit.

Run lint, typecheck, tests, seed and smoke. Commit: "feat(extract): add extract endpoint, suggestions and parser health".
```

---

## Prompt 8: Finish Phase 2

```
Final step of Phase 2.

1. Go through the Phase 2 checklist and "Done when" in docs/ROADMAP.md and verify each item. Run lint, typecheck, npm test, npm run seed -- --reset, npm run smoke and npm run adapters:live.
2. Security check: the fetcher refuses private targets in a live check against the running API (POST /extract with http://127.0.0.1:5001/api/v1/health and http://169.254.169.254/), extraction logs contain no query strings, no page HTML is stored or logged.
3. Update docs/ROADMAP.md (tick, Phase 2 ✅, Phase 3 🟡, notes including which real stores worked in adapters:live) and spec §20 for any divergence.
4. Update CLAUDE.md: Current phase → Phase 3; Commands (adapters:live, mockstores); add "Phase 2 building blocks": safeFetch / browserFetch (never fetch store pages any other way), normaliseUrl / extractFirstUrl / findStoreForUrl, adapter registry and how to add a store (folder + fixtures + expected JSON + tests), storage driver, queue factory + runX pattern, cache_images, suggestions config, extraction logs, startMockstores in tests.
5. Commit: "docs: complete phase 2".
6. Short summary and anything to flag before Phase 3.
```
