# ALLinONEcart – Phase 10 prompts: Motivation V2, lists, sharing and AI (V2)

**Goal:** deeper motivation (projections, plans, streaks), organisation and sharing (lists, tags, shared and gift lists), and AI help, all without breaking the privacy rules.
**Spec:** §8.9 plus new sections written in Prompt 1. The spec is thin here on purpose, so this phase starts by writing it.

Start a fresh session (`/clear`).

---

## Prompt 1: Write the spec for Phase 10 (no code)

```
We are starting Phase 10 of ALLinONEcart. Make sure CLAUDE.md and the roadmap say Phase 10.

Read: CLAUDE.md, docs/ROADMAP.md (Phase 10), docs/PROJECT_SPEC.md §2, §5, §6, §8, §11, §12, §14.

The spec does not yet describe Phase 10 in detail. Do NOT write code. Propose new spec sections as a diff I can approve:
1. §8.12+ Motivation rules: income vs goals series; projections (date each goal is reached at the current saving rate and at an assumed income growth – inputs, formula, rounding, what "saving rate" means); savings plan calculator (monthly amount to reach a target date); EMI view (formula, rate and tenure inputs, clearly labelled as an estimate, not financial advice); split savings across goals (one transaction, allocation rules); Goals: all of the above. Cart: monthly spending limit, cooling-off (§8.9 detail), "Still want this?". Both: streaks (what counts in each section) and badges (list with exact rules). Keep every rule inside one section (spec D6) – nothing that adds Cart and Goals together.
2. Lists and tags (Cart only – e.g. "Wedding outfits" across store carts): data model (lists, list_items, list_members, tags, cart_item_tags), roles (owner, editor, viewer), what a member can see (only the cart items in that list – never goals, money, contributions or other cart items), invites (link or phone), leaving, removing, gift lists ("someone already bought this" hidden from the owner by default), limits.
3. Sharing images: cart item card, goal card and vision board images rendered on the device (no server rendering of private data).
4. AI: features (cart-category suggestion from title, goal horizon/category suggestion, goal price estimate, monthly insights per section), provider abstraction with a mock for dev/tests (like MedAssist: one service, versioned prompts, Zod output schemas, daily budget, no titles/notes sent where not needed, never logging prompts or outputs), kill switch, consent, and what the user sees when AI is off or fails.
5. New endpoints, notification types (daily_motivation, list_invite, gift_reserved), audit actions, error codes, state machines.
6. New env vars.
7. The order to build it in (I suggest: money features → cooling-off/streaks/badges → lists/sharing → AI).

Wait for my approval, then write the approved sections into docs/PROJECT_SPEC.md and §19, update the roadmap Phase 10 checklist to match, and commit "docs(spec): specify phase 10".
```

---

## Prompt 2: Motivation money features

```
Build step 1 of Phase 10 (spec sections approved in Prompt 1).

Server: income vs goals series endpoint, GET /projections, POST /tools/savings-plan, POST /tools/emi (pure functions in utils with table tests; integer maths; inputs validated), split savings across goals (POST /contributions/split in one transaction updating each goal), Cart monthly spending limit (settings + a check that warns, never blocks a save). All numbers come from the dashboard metrics module or new pure utils – never computed in controllers or the app.
Mobile: income vs goals chart (with a text summary), projection line on goal detail ("At this rate: March 2029"), savings plan and EMI calculators (labelled estimates), split savings sheet, monthly limit setting and warning banner.
Seed + golden numbers for Asha's projections and one EMI example; smoke checks.
Tests for every formula, ownership, transaction consistency.

Run lint, typecheck, tests, seed --reset, smoke, e2e. Commit: "feat(motivation): add projections, plans, emi, split savings and monthly limit".
```

---

## Prompt 3: Cooling-off, still-want-this, streaks, badges and daily motivation

```
Build step 2 of Phase 10.

Server: cooling-off on create for cart items under the threshold (status waiting, §5.1), cooling_off_release job, stale_cart_check job ("Still want this?" in-app prompt data), streak and badge evaluation (pure rules from the spec; awarded once; user_badges collection), daily_motivation notification (off by default; picks one goal; no title in text), all through notify() with dedupe keys; add new user-owned collections to export and purge.
Mobile: waiting state with countdown and muted Buy, "Still want this?" card on Home, badges screen and award toast, streak indicator, daily motivation setting, vision board wallpaper export (render on device with react-native-view-shot, save to photos with permission).
Tests with a fixed clock for every job and rule.

Run lint, typecheck, tests, smoke, e2e. Commit: "feat(motivation): add cooling-off, streaks, badges and daily motivation".
```

---

## Prompt 4: Lists, tags, sharing and gift lists

```
Build step 3 of Phase 10.

Server: lists, list_items, list_members, tags, cart_item_tags per the approved spec; a policies/listAccess.ts (members see only the cart items in that list, never goals, money or contributions; others → 404); invites by link (signed, expiring) or phone; leave/remove; gift lists with "reserved by" hidden from the owner; drag-to-reorder (sortOrder) for cart items, goals and lists; list_invite and gift_reserved notifications; export and purge include the new collections; route inventory and ownership tests for every route, including a member trying to read the owner's other cart items or goals.
Mobile: lists screen (inside the Cart tab), list detail, add to list from cart item detail, tags with filter, reorder with drag handles (accessible alternative: move up/down), invite and join flows (deep link), gift list view for friends, share a cart item card, a goal card or the vision board as an image (rendered on device).
Tests and Maestro 010_lists.yaml (create list, invite Ravi, Ravi sees only that list).

Run lint, typecheck, tests, seed --reset, smoke, e2e. Commit: "feat(lists): add lists, tags, sharing and gift lists".
```

---

## Prompt 5: AI features

```
Build step 4 of Phase 10.

Server: ai/ai.service.ts as the only way to call a model (OpenAI-compatible provider via fetch + a mock provider for dev/tests/seed); versioned prompts with Zod output schemas; one retry on invalid JSON; daily budget; ai_interactions rows with metadata only (no prompts or outputs); kill switch per feature and user consent; tests make real fetch impossible.
Features: cart-category suggestion (title + store only) used by /extract and goal horizon/category suggestion used by goal creation, falling back to the rule-based config; goal price estimate ("BMW M340i in India" → range with a "rough estimate" label, never stored as the user's price without confirmation); monthly insights per section from aggregated numbers only (no titles or notes sent; Cart and Goals insights shown separately).
Mobile: "Suggested by AI" labels, estimate sheet on goal creation, insights card on Home, all hidden when the feature flag is off.
Tests: provider failures, invalid output, budget exhausted, kill switch, nothing sensitive in ai_interactions or logs, app works fully with AI off.

Run lint, typecheck, tests, smoke, e2e. Commit: "feat(ai): add suggestions, estimates and insights".
```

---

## Prompt 6: Finish Phase 10

```
Final step of Phase 10.

1. Verify the checklist. Run lint, typecheck, tests with coverage, seed --reset, smoke, e2e.
2. Privacy re-check: list members can't reach goals, money or other cart items (run the ownership sweep for list routes), shared images contain only what the user chose, AI receives no titles/notes where the spec says it mustn't, export and purge cover every new collection.
3. Update docs/ROADMAP.md (Phase 10 ✅, Phase 11 🟡), spec §20, CLAUDE.md (Current phase → Phase 11; "Phase 10 building blocks": projection/EMI/savings-plan utils, split savings transaction, cooling-off and badge rules, listAccess policy, invite links, ai.service and prompt files, AI flags and consent).
4. Commit: "docs: complete phase 10". Summary and flags.
```
