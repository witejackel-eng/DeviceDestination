# Baseline — recorded before hardening work begins

Captured on the `backend-security-seo-hardening` branch immediately after
cloning, before any phase work.

## Tooling

- Node: v24.18.0
- Bun: 1.x (local dev/runtime)
- PostgreSQL 17.10 (local test instance, port 5433, Unix socket `/home/z/pg/socket`)
- Drizzle ORM 0.45, migrations 0000–0002 applied to test DB `devicedestination_test`

## Baseline results

| Check | Result |
| --- | --- |
| `bun run lint` | FAIL — 27 errors, 82 warnings (mostly `no-explicit-any` in tests) |
| `bun run typecheck` | PASS |
| `bun run test` (no DB) | 104 unit pass, 41 integration skipped |
| `bun run test` (with local Postgres + `DB_DRIVER=node-postgres`) | 144 pass, 1 fail, 0 skipped |
| `bun run build` | PASS |
| `bun run test:integration` | No-op (`echo ... && exit 0`) — spec calls this out |

## The 1 failing integration test

`tests/integration/checkout.test.ts > concurrent identical checkout requests create one checkout attempt`

Two concurrent `orchestrateCheckout` calls with the same idempotency key should
both resolve (one `ready_for_checkout`, one `duplicate_completed`). Only one
resolves today because the orchestrator uses a read-then-insert pattern that
races. This is exactly the defect Phase 2 is written to fix, so the test is
the acceptance criterion for that phase.

## Local test infra changes already made

To make integration tests actually run against a local Postgres (they previously
skipped silently because `@neondatabase/serverless` cannot speak to a local
Postgres), the following minimal, justified changes were made:

- `src/db/client.ts`: dual-driver support. Production keeps using
  `neon-http`; when `DB_DRIVER=node-postgres` or the URL is not a Neon/Vercel/
  Supabase host, the client uses `pg` + `drizzle-orm/node-postgres`. This is
  the only way to exercise real `FOR UPDATE SKIP LOCKED`, advisory locks, and
  interactive transactions in tests.
- `tests/helpers/setup.ts`: same driver switch for the test DB; UUID-safe
  `testId()` generator (previous helper generated non-UUID strings for UUID
  columns, which is why the tests never ran); `seedProduct`/`seedInventory`/
  `seedOrderWithPayment` made idempotent so a product+inventory pair can be
  reused across helpers.
- `tests/integration/{webhook,checkout,inventory}.test.ts`: fixed pre-existing
  bugs that only surface when the tests actually execute (SQL parameter
  binding, mock assignment on read-only module namespace, unique-constraint
  collisions from a hard-coded mock provider order id, confused inventory
  seed counts).

These are baseline-recovery changes, not hardening. Hardening work begins at
Phase 1.
