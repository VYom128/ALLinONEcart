# ALLinONEcart – Phase 11 prompts: More platforms (V2)

**Goal:** reach users outside the phone app: home-screen widgets, a user web app and a Chrome extension. Also hide-amounts mode and backup.
**Spec:** §9.1, §11.2 plus new sections written in Prompt 1.

Start a fresh session (`/clear`).

---

## Prompt 1: Write the spec for Phase 11 (no code)

```
We are starting Phase 11 of ALLinONEcart. Make sure CLAUDE.md and the roadmap say Phase 11.

Read: CLAUDE.md, docs/ROADMAP.md (Phase 11), docs/PROJECT_SPEC.md §3, §9.1, §11, §13.

Do NOT write code. Propose spec additions as a diff:
1. Widgets: which widgets (next milestone, rotating goal photo), what data they may show on a lock/home screen (no amounts when hide-amounts or app lock is on), refresh strategy, iOS WidgetKit and Android Glance via Expo config plugins (or a library) – pick and justify.
2. User web app: scope (browse, edit, add by link, dashboard – no share sheet), stack (reuse the admin/ setup: React + Vite + Tailwind + RTK Query, or Expo for web – pick and justify), auth on the web (OTP + Google; refresh token in an HttpOnly, SameSite=Strict cookie on /api/v1/auth only; CSRF protection), hosting.
3. Chrome extension: Manifest V3; "Save to ALLinONEcart" button/popup on product pages; auth (sign in through the web app and a scoped extension token, or OAuth flow – pick and justify); permissions kept minimal (activeTab, no broad host permissions); sends only the URL to /extract.
4. Hide-amounts mode (blur everywhere, including widgets and notifications) and backup/restore (encrypted export the user can re-import into a new account? or server-side only – decide).
5. New endpoints, env vars, error codes, security rules.
6. Build order.

Wait for my approval, then write the approved sections into the spec, update the roadmap Phase 11 checklist, and commit "docs(spec): specify phase 11".
```

---

## Prompt 2: Hide-amounts mode and backup

```
Build step 1 of Phase 11 (approved spec).

Mobile: hide-amounts setting; every money display goes through one <Money> component that blurs or masks when on (search the code for formatINR uses outside it and replace them); notifications and share images respect it. Server: backup/restore per the approved design, with tests.

Run lint, typecheck, tests, e2e. Commit: "feat: add hide-amounts mode and backup".
```

---

## Prompt 3: Home-screen widgets

```
Build step 2 of Phase 11 (approved spec).

Widgets per the spec (iOS and Android), fed by a small GET /widgets/summary endpoint (ids, image URLs, progress percent – amounts only when allowed), refreshed on app use and on a schedule; tap opens the right screen. Tests for the endpoint and the data rules; manual test steps for each platform.

Run lint, typecheck, tests. Commit: "feat(mobile): add home-screen widgets".
```

**Check after**
- [ ] Rebuild the development build, add both widgets on your phone and check that hide-amounts hides money in them

---

## Prompt 4: User web app

```
Build step 3 of Phase 11 (approved spec).

Web workspace per the spec: sign in (OTP, Google), web auth with the HttpOnly refresh cookie + CSRF protection on the server (tests), Home with separate Cart and Goals cards, Cart (by store / by category, item detail and edit, add by link via /extract, buy, bought history), Goals (by horizon / by category, detail, savings, income, achieved wall) as separate sections, settings (subset). Same server rules – no business numbers computed on the client. Responsive from 360 px. Tests with Vitest + RTL + MSW; a Playwright happy path. Deployment config (e.g. Vercel) and CLIENT_URLS.

Run lint, typecheck, tests, build. Commit: "feat(web): add user web app".
```

---

## Prompt 5: Chrome extension

```
Build step 4 of Phase 11 (approved spec).

extension/ workspace: Manifest V3, popup with "Save to Cart" (sends the active tab URL to /extract, shows the preview, category/priority, Save to the Cart – never to Goals), sign-in per the approved design, minimal permissions, no content scripts reading page data unless the spec says so. Tests for the popup logic; a packaged build and Chrome Web Store listing notes (permissions justification, privacy answers).

Run lint, typecheck, tests, build. Commit: "feat(extension): add chrome extension".
```

---

## Prompt 6: Finish Phase 11 and V2

```
Final step of Phase 11.

1. Verify the checklist. Run every test suite, smoke (local and staging), mobile e2e, web Playwright.
2. Security re-check for the new surfaces: web cookie flags, CSRF, CORS allow-list, extension permissions and token scope, widget data on locked screens.
3. Update docs/ROADMAP.md (Phase 11 ✅; mark V2 complete; move anything left to the Backlog), spec §20, CLAUDE.md (Current phase → "Maintenance – pick work from the Backlog"; "Phase 11 building blocks": Money component and hide-amounts rule, widget summary endpoint, web auth cookies + CSRF, extension auth).
4. Commit: "docs: complete phase 11 – v2 done".
5. Summary of the whole V2 and a suggested order for the Backlog items based on our analytics.
```
