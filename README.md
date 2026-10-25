# ALLinONEcart

A mobile app with two separate sections: **Cart** – every store's cart in one place (Myntra,
Amazon, Zara, H&M, Flipkart…), saved by sharing product links, grouped by store with live prices –
and **Goals** – big life goals with target prices, savings progress and hours of work.

- Requirements (source of truth): [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)
- Build plan and progress: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Conventions for working on the code: [`CLAUDE.md`](CLAUDE.md)

## Prerequisites

- **Node 24 LTS** (`.nvmrc`; `nvm use`) and npm 11
- **Docker Desktop** (MongoDB replica set, Redis, MinIO)
- **Expo Go** on your phone (Phase 0 only; from Phase 1 an Expo development build)
- Optional: Xcode (iOS Simulator) or Android Studio (emulator)

## Setup

```bash
git clone <repo-url> ALLinONEcart && cd ALLinONEcart
npm install
npm run services:up                     # MongoDB rs0, Redis, MinIO (+ creates the allinone-dev bucket)
cp server/.env.example server/.env
cp mobile/.env.example mobile/.env      # on a phone: set your computer's LAN IP (below)
npm run seed
npm run dev                             # API + worker + mockstores + Expo
```

**Phone:** in `mobile/.env` set `EXPO_PUBLIC_API_URL=http://<LAN-IP>:5001/api/v1`
(macOS: `ipconfig getifaddr en0`); the phone must be on the same Wi-Fi. Restart Expo after
changing it.

**Opening the app:** `npm run dev` runs Expo without a terminal, so it prints no QR code. Either
open `exp://<LAN-IP>:8081` in Expo Go ("Enter URL manually"), or use two terminals –
`npm run dev:backend` and `npm run dev:mobile` – to get Expo's QR code and keyboard shortcuts.

**Ports:** API 5001 (macOS AirPlay holds 5000), Metro 8081, mockstores 4010, MongoDB **27018**
(so a local MongoDB on 27017 can keep running), Redis 6379, MinIO 9000 (console 9001,
`minioadmin` / `minioadmin`). Override the Docker host ports in a root `.env` (see `.env.example`).

## Scripts

| Script                                                                | What it does                                                                                                |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run services:up` / `services:down` / `services:logs`             | Start (and wait for) / stop / follow the Docker services                                                    |
| `npm run dev`                                                         | API, worker, mockstores and Expo together                                                                   |
| `npm run dev:backend`                                                 | API, worker and mockstores (run `dev:mobile` in a second terminal)                                          |
| `npm run dev:server` / `dev:worker` / `dev:mockstores` / `dev:mobile` | One process each                                                                                            |
| `npm test`                                                            | Shared, server, then mobile tests                                                                           |
| `npm run test:shared` / `test:server` / `test:mobile`                 | One workspace's tests                                                                                       |
| `npm run test:coverage`                                               | Server tests with v8 coverage                                                                               |
| `npm run lint` / `lint:fix`                                           | ESLint over the whole repo                                                                                  |
| `npm run format` / `format:check`                                     | Prettier                                                                                                    |
| `npm run typecheck`                                                   | `tsc --noEmit` in every workspace                                                                           |
| `npm run seed`                                                        | Load the seed (spec §15.5); `npm run seed -- --reset` empties every collection first. Refuses in production |
| `npm run smoke`                                                       | API smoke checks; reuses an API on `PORT` or starts a temporary one                                         |
| `npm run build:shared`                                                | Build `shared/` to `dist` (runs automatically before dev, test, typecheck, seed, smoke)                     |

## Folder structure

```
server/       Express API + BullMQ worker
  src/        app.ts server.ts worker.ts config/ middlewares/ modules/ policies/ services/
              adapters/ jobs/ routes/ utils/ seed/
  tests/      Vitest + Supertest (helpers/, unit/)
  smoke/      npm run smoke (checks/<phase>.ts)
shared/       Enums, state machines and API types used by server and mobile
mobile/       Expo app: app/ (Expo Router), src/{components/ui,features,store,config,utils}
mockstores/   Test server for saved store pages (stores/<store>/*.html)
docs/         Spec, roadmap, phase prompts
```

## API response format

All endpoints live under `/api/v1` and return JSON.

```jsonc
// 200 OK
{ "success": true, "message": "OK", "data": { "status": "ok", "db": "connected" }, "meta": { "nextCursor": "…" } }

// 400 Bad Request
{
  "success": false,
  "message": "Validation failed",
  "error": { "code": "VALIDATION_ERROR", "details": [{ "field": "body.title", "message": "Required" }] },
  "requestId": "6f1c2b0e-…"
}
```

`meta` appears only when there is some. Error codes are listed in spec §16 and in
`ERROR_CODES` (`server/src/config/constants.ts`). Every response carries an `X-Request-Id` header.

## How to add a backend module

Each feature lives in `server/src/modules/<feature>/` (`model.ts`, `service.ts`,
`controller.ts`, `routes.ts`, `validation.ts`, `serializer.ts`). Controllers are thin; rules live in
services; errors are thrown as `ApiError` and formatted by the error handler.

```ts
// server/src/modules/notes/validation.ts
import { z } from 'zod';
export const noteParams = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) });

// server/src/modules/notes/controller.ts
import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { serializeNote } from './serializer.js';
import * as notes from './service.js';

export async function getNote(req: Request, res: Response) {
  // req.user is set by `authenticate` (Phase 1); the service filters by user.
  const note = await notes.findForUser(req.user.id, req.params.id!);
  if (!note) throw ApiError.notFound('Note not found'); // another user's record is a 404 too
  sendSuccess(res, { data: serializeNote(note) }); // never send raw Mongoose documents
}

// server/src/modules/notes/routes.ts
import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getNote } from './controller.js';
import { noteParams } from './validation.js';

export const notesRouter = Router();
// From Phase 1: authenticate → authorize(...roles) → validate → controller
notesRouter.get('/notes/:id', validate({ params: noteParams }), asyncHandler(getNote));
```

Mount it in `server/src/routes/index.ts` (`apiRouter.use(notesRouter)`) and add API tests:
success, validation failure, 401 (from Phase 1) and another user's record (404).

## How to add a smoke check

`npm run smoke` runs every check in `server/smoke/checks/index.ts` against a running API with the
seed loaded. Each phase adds one file:

```ts
// server/smoke/checks/phase1.ts
import assert from 'node:assert/strict';
import type { SmokeCheck } from '../types.js';

export const phase1Checks: SmokeCheck[] = [
  {
    name: 'GET /me without a token is 401',
    async run({ request }) {
      const res = await request('/me');
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    },
  },
];
```

Then append it in `checks/index.ts`: `[...phase0Checks, ...phase1Checks]`. A check fails by
throwing; the runner prints ✓/✗ per check and exits 1 on any failure. Checks that write must undo
their writes.

## How the seed and golden numbers work

- `npm run seed` runs the seeders listed in `server/src/seed/index.ts` (`SEEDERS`), in order.
  They are idempotent upserts through the services, with fixed ids and values, so running the seed
  twice changes nothing. `--reset` empties every collection first.
- `server/src/seed/expectations.json` holds the **golden numbers**: totals computed **by hand** from
  the seed, in separate `cart` and `goals` blocks (Cart and Goals totals are never combined).
  Seed tests and smoke checks assert them exactly.
- Change `expectations.json` only when the seed is changed on purpose, and say so in the commit.
  Never edit it to make a failing test pass. See `server/src/seed/README.md`.
