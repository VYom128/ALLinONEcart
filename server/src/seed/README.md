# Seed

- `npm run seed` loads the fixed seed data (spec §15.5): idempotent upserts through the services,
  with fixed ids and values. `npm run seed -- --reset` empties every collection first.
  It refuses to run when `NODE_ENV=production`.
- Seeders are listed in `index.ts` (`SEEDERS`), in run order. Each phase adds its own.

## Golden numbers (`expectations.json`)

`expectations.json` holds the **golden numbers**: values computed **by hand** from the seed data,
in two separate blocks, `cart` and `goals` (spec §15.5, D6 – never one combined total). Seed tests
and `npm run smoke` assert them exactly.

It is `{}` until seed data exists. Add numbers by hand when seed data is added, and change them
only when the seed is changed on purpose (say so in the commit). Never edit them to make a
failing test pass.
