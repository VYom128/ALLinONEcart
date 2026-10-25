# ALLinONEcart – Phase 3 prompts: Cart

**Goal:** share products from any store app into the **Cart** and see every store's cart in one place (my Myntra cart, my Amazon cart, my Zara cart…), with correct totals. Goals are a separate section built in Phase 4. Nothing in this phase touches goals.
**Spec:** §4.1–4.2, §4.4, §4.7, §5.1 (cart), §6.9 (`cart_items`), §7.7, §8.1–8.2, §8.6–8.8, §13 and decision D6

Start a fresh session (`/clear`).

---

## Prompt 1: Read and plan (no code)

```
We are starting Phase 3 of ALLinONEcart: the Cart section.

Read these first:
- CLAUDE.md (building blocks of Phases 0–2, and the rule that Cart and Goals are separate sections)
- docs/ROADMAP.md (Phase 3)
- docs/PROJECT_SPEC.md §4.1–4.2, §4.4, §4.7, §5.1 (cart machine), §6.9 (cart_items), §7.7, §8.1–8.2, §8.6–8.8, §13, §20 D6

Do NOT write code yet. Give me:
1. New server files (modules/cart, its status service) and mobile files (features/cart, screens, UI kit additions).
2. New packages and why (e.g. expo-share-intent, expo-clipboard, expo-web-browser, @shopify/flash-list).
3. How the cart status machine is enforced (assertTransition + conditional update + statusHistory) and which endpoints change status.
4. How cart totals and store groups are computed (one aggregation per request? per filter?) and how they stay equal to the golden numbers.
5. The seed cart items for Asha and Ravi (store, title, price, quantity, status) and the cart golden numbers you will compute by hand for expectations.json (block "cart").
6. How the share intent works on iOS and Android with Expo (config plugin, dev build rebuild) and how the Add-to-Cart sheet gets the URL.
7. Confirm that nothing in this phase creates goal code, a shared "item" model, or a combined total.
8. Build order matching the next prompts, and anything unclear.

Wait for my approval before building.
```

**Check:** the seed should cover all six stores you use (Myntra, Amazon, Zara, H&M, Bear House, Flipkart) and every cart status except `waiting` (that one comes in V2).

---

## Prompt 2: Cart model, status machine and add to cart

```
Build step 1 of Phase 3. Server. Spec §5.1 (cart), §6.9 (cart_items), §7.7, §8.6–8.8.

1. utils/stateMachine.ts – assertTransition(machine, from, to) using shared canTransition → 409 INVALID_STATUS_TRANSITION.
2. modules/cart/model.ts – CartItem per spec §6.9 (cart_items) with indexes; store copied from the Product; validators for paise and quantity. The category must have section 'cart'.
3. modules/cart/status.service.ts – applyCartTransition(cartItem, to, { session, extra }) → conditional findOneAndUpdate({ _id, user, status: from }), push statusHistory, adjust the Product's activeCartCount when moving in/out of in_cart/waiting; a lost race → 409 CONFLICT.
4. POST /cart { url | productId, title?, pricePaise?, selectedVariant, quantity, category, priority, notes?, allowDuplicate? } – resolves the Product (by productId, or by running the extract service for url), copies title/price/image from the Product unless given, rejects a duplicate active cart item for the same Product with 409 DUPLICATE_ITEM (details.cartItemId) unless allowDuplicate; category must be a cart category (built-in or own, else 404); cap 500 active cart items (config; ITEM_LIMIT_REACHED with details.section 'cart'); create + activeCartCount in one transaction.
5. Tests: create from productId and from a mockstores URL, duplicate rules, a goal-section category is rejected, other user's category → 404, limits, assertTransition table for the cart machine, concurrent transition race → one wins.

Run lint, typecheck, tests. Commit: "feat(cart): add cart item model, status machine and add to cart".
```

---

## Prompt 3: Cart list, store groups, detail, actions, seed and golden numbers

```
Build step 2 of Phase 3. Server. Spec §7.7, §8.1–8.2, §15.5.

1. GET /cart – filters status (default active = in_cart/waiting), store, category, q (prefix search on title words with escaped regex – never a regex from raw input); sort newest | price_asc | price_desc | priority; cursor pagination; meta.totals { count, totalPaise } for the whole filter.
2. GET /cart/groups?by=store|category → [{ key, label, logoUrl?, count, totalPaise }] for active cart items, one aggregation, ordered by total desc. By store, each group is one "store cart" (e.g. Myntra cart).
3. GET /cart/:id (with the Product's live price, store, category), PATCH /cart/:id (title, pricePaise, quantity, selectedVariant, category, priority, notes – never status), DELETE /cart/:id (transaction; activeCartCount).
4. POST /cart/:id/bought { paidPaise, at? }, /unbuy (within 7 days), /remove, /restore via applyCartTransition. GET /cart/bought (bought history, cursor). GET /cart/:id/buy-link → { url } (canonical URL; affiliate links in Phase 9).
5. Categories: deleting a custom cart category moves its cart items to the cart "other" category in a transaction.
6. Serializers: cart item view and card view (no storage keys).
7. Seed (cart.seed.ts): build Products from mockstores fixtures through the extract service (MOCKSTORES_URL), then Asha's 9 cart items across Myntra, Amazon, Zara, H&M, Bear House and Flipkart (1 bought, 1 removed, 1 custom cart category) and Ravi's 2, as planned. Write the "cart" block of server/src/seed/expectations.json by hand: Asha's count and totalPaise overall, per store, per category, bought this month/year; Ravi's totals. Show me how you computed each number.
8. tests/cart.golden.test.ts – GET /cart meta.totals and GET /cart/groups match expectations.json exactly. Also: filters, every sort, cursor paging returns every item once, q search, other user's cart item → 404 on every route, remove → excluded from totals, restore → back, bought → moves to bought history and leaves the totals.
9. Smoke (phase3.ts): Asha's cart totals and store groups equal expectations.json; Ravi can't read Asha's cart item (404); mark one item bought and undo it.

Run lint, typecheck, tests, seed --reset and smoke. Commit: "feat(cart): add cart list, store groups, actions and seeded golden totals".
```

**Check after**
- [ ] The golden numbers were worked out by hand, not by calling the app's code
- [ ] `npm run smoke` passes and leaves the data as it was

---

## Prompt 4: Mobile – UI kit and onboarding

```
Build step 3 of Phase 3. Mobile. Spec §4.1, §13.3.

1. Extend src/components/ui: TextField, MoneyField (types ₹ with Indian digit grouping, value in paise, no floats – use shared rupeesToPaise), Select (bottom sheet), Segmented, Chip, CartItemCard (image, title, price × quantity, store logo, priority, status pill), StoreHeader (logo, store name, count, total), ProgressBar, StatTile, EmptyState, Sheet, Toast, FAB. utils/money.ts formatINR(paise) with tests (₹1,49,999; ₹1.4 Cr short form option).
2. Onboarding (app/(onboarding)/): profile (name), stores (favourite stores, multi-select), income (optional monthly income + hours per month, explained as "used to show your goals in hours of work"), tutorial (3 slides on adding items to the Cart from store apps). Finish → POST /me/onboarding/complete. (The first-goal step is added in Phase 4.)
3. Route guard: signed in + onboarding not complete → (onboarding); complete → (tabs). Tabs for now: Home (placeholder), Cart, Profile. The Goals tab comes in Phase 4.
4. Tests: MoneyField input/paise conversion, formatINR, onboarding navigation and skip, guard routing.

Run lint, typecheck, tests. Commit: "feat(mobile): add ui kit and onboarding".
```

---

## Prompt 5: Mobile – share sheet and Add-to-Cart sheet

```
Build step 4 of Phase 3. Mobile. Spec §4.2, §9.1.

1. Share intent: add expo-share-intent (config plugin) so ALLinONEcart appears in the iOS and Android share sheets for URLs and text. A share always opens app/cart/add.tsx (modal) with the first URL – shares never go to Goals. Tell me which rebuild of the development build is needed.
2. Paste link: the Cart tab has an "Add from link" button with a text field; on app focus, if the clipboard holds a store URL, show a small "Add this link to your Cart?" banner (respect iOS paste permission; once per URL).
3. Add-to-Cart sheet: calls POST /extract; skeleton, then the preview (image carousel, title, price, store); variant pickers from availableVariants (size, colour, storage), quantity, category (pre-selected from the suggestion, cart categories only), priority, notes; Save → POST /cart; DUPLICATE_ITEM → "Already in your Zara cart – Open it / Add anyway"; partial preview → show what was found and let the user fill the rest; EXTRACT_FAILED → manual form with the URL kept (title, price, store).
4. After saving: toast "Added to your <Store> cart" + navigate to the item; RTK Query invalidates CartItem and CartGroups tags.
5. Tests: sheet states (loading, full, partial, failed → manual, duplicate), variant picker.
6. Maestro: 003_add_to_cart.yaml (open the app with a deep link that simulates a shared mockstores URL, pick a size, save, see it under its store in the Cart).

Run lint, typecheck, tests. Commit: "feat(mobile): add share sheet and add-to-cart sheet".
```

**Check after**
- [ ] Rebuild and install the development build
- [ ] On your phone, share a real product from the Myntra, Amazon and Zara apps to ALLinONEcart; each one lands in its own store cart

---

## Prompt 6: Mobile – Cart tab, cart item detail, Buy and Bought history

```
Build step 5 of Phase 3. Mobile. Spec §4.4, §4.7, §13.

1. Cart tab (app/(tabs)/cart.tsx): total in carts and count at the top; segmented By store | By category. By store: one collapsible section per store cart (StoreHeader with logo, "Myntra cart · 4 items · ₹8,960") listing its items; By category: the same by cart category. Data from /cart/groups and /cart (FlashList, cursor pagination). Search (debounced q), filter sheet (status incl. removed, store, category), sort, grid/list toggle. Pull to refresh. Empty states ("Your cart is empty – share a product from any shopping app").
2. Cart item detail (app/cart/[id].tsx): images, title, store, price × quantity (live price from the Product), variant, category, priority, notes, status; actions Buy on store, Edit, Remove / Restore, Delete (confirm).
3. Buy on store: GET /cart/:id/buy-link → open the store app via universal link if installed, else expo-web-browser; remember the buy start in memory. When the app returns to the foreground within 2 hours: "Did you buy it?" → Yes: paid price (pre-filled) and date → POST bought → toast; Not yet → dismiss.
4. Bought history (app/cart/bought.tsx): newest first, store, paid price, date; undo within 7 days.
5. Edit (app/cart/[id]/edit.tsx).
6. Tests: store sections render server groups and totals as given (never recomputed), pagination, filters update the query, detail actions, buy-return prompt timing.
7. Maestro: 004_cart_browse.yaml – switch By store / By category, open an item, remove it, see the store total change, restore it, mark another bought.

Run lint, typecheck, tests and e2e. Commit: "feat(mobile): add cart tab, item detail, buy flow and bought history".
```

**Check after**
- [ ] On your phone: the Cart tab shows a section for each store you shared from, with the right totals
- [ ] Tap Buy on a Myntra item. The Myntra app opens, and coming back shows "Did you buy it?"

---

## Prompt 7: Finish Phase 3

```
Final step of Phase 3.

1. Verify the Phase 3 checklist and "Done when" in docs/ROADMAP.md. Run lint, typecheck, npm test, npm run seed -- --reset, npm run smoke and npm run e2e:mobile.
2. Check: every new endpoint has success, validation, 401 and other-user-404 tests; the route inventory covers the new routes; no cart titles, notes or URLs in logs (extend logging.test.ts with a cart create); no code references goals or a shared "item" model.
3. Sign in as Asha on the phone and compare the Cart totals (overall and per store) with expectations.json. Report any difference.
4. Update docs/ROADMAP.md (tick, Phase 3 ✅, Phase 4 🟡, notes) and spec §20 for divergences.
5. Update CLAUDE.md: Current phase → Phase 4; add "Phase 3 building blocks": assertTransition + applyCartTransition (the only way to change cart status), activeCartCount rule, cart list filters/cursor/totals, cart groups endpoint (store carts), cart serializers, expectations.json "cart" block and cart.golden.test.ts, mobile UI kit (CartItemCard, StoreHeader, MoneyField, formatINR), share intent → cart/add, buy-link + buy-return prompt, Maestro flows.
6. Commit: "docs: complete phase 3".
7. Short summary and anything to flag before Phase 4.
```
