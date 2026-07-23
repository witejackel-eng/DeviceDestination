# CI Integration Tests

This document describes the CI workflow, integration test infrastructure, and how to run integration tests locally.

## CI workflow structure

The CI workflow (`.github/workflows/ci.yml`) runs two parallel jobs:

### Test job

Runs on `ubuntu-latest` with a PostgreSQL 16 service container:

1. **Checkout code**
2. **Setup Node 20** with npm cache
3. **Install dependencies** (`npm ci`)
4. **Wait for PostgreSQL** — polls `pg_isready` until the service container is ready
5. **Run migrations** (`npx drizzle-kit migrate` against the test database)
6. **Lint** (`npm run lint`)
7. **Typecheck** (`npm run typecheck`)
8. **Unit tests** (`npm test`)
9. **Integration tests** (`npm run test:integration`)
10. **Validate product data** (`npm run products:validate`)
11. **Validate theme** (`npm run theme:validate`)
12. **Build** (`npm run build`)
13. **Audit dependencies** (`npm audit --audit-level=high`, continue-on-error)

### Security-scan job

Runs on `ubuntu-latest` in parallel with the test job:

1. **Check for committed `.env` files** — scans git-tracked files for `.env`, `.env.local`, `.env.production`, `.env.staging`, `.env.development`. Fails the build if any are found.
2. **Scan for secret patterns** — looks for RSA/SSH private keys, hardcoded AWS tokens, Stripe live keys, GitHub PATs, and hardcoded passwords. Excludes `.env.example`, test fixtures, and the security test file.

## PostgreSQL service container setup

The test job uses GitHub Actions service containers to provide an ephemeral PostgreSQL 16 database:

```yaml
services:
  postgres:
    image: postgres:16
    ports:
      - 5432:5432
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: devicedestination_test
    options: >-
      --health-cmd="pg_isready -U postgres"
      --health-interval=10s
      --health-timeout=5s
      --health-retries=5
```

The `DATABASE_URL` and `TEST_DATABASE_URL` environment variables are set to `postgresql://postgres:postgres@localhost:5432/devicedestination_test`.

Before integration tests run, `npx drizzle-kit migrate` applies all migrations (including `0002_large_toad_men.sql`) to the test database.

## Synthetic CI secrets

The CI workflow uses synthetic secrets that are **never real credentials**:

| Variable | Value | Purpose |
|---|---|---|
| `NODE_ENV` | `test` | Enables test-only features |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/devicedestination_test` | Local PostgreSQL service container |
| `TEST_DATABASE_URL` | Same as `DATABASE_URL` | Used by integration test helpers |
| `BETTER_AUTH_SECRET` | `ci-only-secret-at-least-32-characters-long-for-testing` | Satisfies length requirement, never used for real auth |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Placeholder URL |
| `ADMIN_EMAILS` | `admin@example.test` | CI-only admin email |
| `CRON_SECRET` | `ci-cron-secret-value-for-testing` | Enables the cron endpoint for testing |

**No real Razorpay, Resend, WhatsApp, or Upstash credentials are used in CI.** Integration tests mock all external service calls using vitest mocks.

## Integration test categories

Integration tests live in `tests/integration/` and use `TEST_DATABASE_URL` to connect to a real PostgreSQL database. They are designed to `skipIf(!hasTestDb())` when no test database is available.

### Inventory tests (`tests/integration/inventory.test.ts`)

12 tests covering:
- Reservation succeeds when stock is available
- Reservation fails when stock is insufficient
- Concurrent reservations cannot oversell (Promise.allSettled)
- Reservation-row insert failure compensates the inventory counter
- Activation failure compensates the inventory counter
- Duplicate product lines are aggregated correctly
- Double consume changes stock once (idempotent)
- Double release changes reserved quantity once (idempotent)
- Consume and release racing cannot both succeed (atomic status claims)
- Expired reservation releases quantity once
- Stale pending reservation is reconciled
- Reserved and available quantities never become negative

### Webhook tests (`tests/integration/webhook.test.ts`)

11 tests covering:
- Valid captured event marks payment captured
- Invalid signature is rejected (401)
- Amount mismatch is rejected
- Duplicate completed event performs no duplicate work
- Duplicate incomplete event resumes processing
- Failure after marking paid is recoverable
- Failure during inventory consumption is retried
- Failure during job insertion is retried
- Email, invoice and WhatsApp jobs are deduplicated
- Failed event stores safe error state
- Captured payment after reservation expiry enters inventory review

### Checkout tests (`tests/integration/checkout.test.ts`)

8 tests covering:
- Local order is created once per idempotency key
- Same idempotency key returns the existing ready provider order
- Concurrent identical checkout requests create one checkout attempt
- Razorpay creation failure releases inventory
- Payment-row update failure does not expose an untracked provider order
- Stale checkout attempt can be resumed or safely failed
- Shipping amount is stored correctly
- Trusted database price overrides client data

### Auth tests (`tests/integration/auth.test.ts`)

6 tests covering:
- Unauthenticated admin access fails (401)
- Authenticated non-admin access fails (403)
- Authorized admin access succeeds
- User cannot read another user's order
- User cannot edit another user's address
- Guest-order claiming requires matching verified email

### Migration tests (`tests/integration/migration.test.ts`)

4 tests covering:
- Apply every migration to an empty PostgreSQL database
- Verify expected indexes and unique constraints
- Verify enum values match the schema definitions
- Verify migration journal consistency

## How to run integration tests locally

### Prerequisites

1. A PostgreSQL database accessible locally (or via Neon).
2. Set `TEST_DATABASE_URL` to the connection string.

### Setup

```bash
# Create a test database
createdb devicedestination_test

# Set the environment variable
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/devicedestination_test"

# Run migrations against the test database
DATABASE_URL=$TEST_DATABASE_URL npx drizzle-kit migrate
```

### Running tests

```bash
# All integration tests
npm run test:integration

# Specific test file
npx vitest run tests/integration/inventory.test.ts
npx vitest run tests/integration/webhook.test.ts
npx vitest run tests/integration/checkout.test.ts
npx vitest run tests/integration/auth.test.ts
npx vitest run tests/integration/migration.test.ts
```

Tests that require a database will skip automatically if `TEST_DATABASE_URL` is not set, with a message: "Skipping: [reason]. Set TEST_DATABASE_URL to run this test."

### Cleanup

The test helpers (`cleanupTestData` in `tests/helpers/setup.ts`) delete all rows with test prefixes (`itest_*`) from every table in reverse dependency order. This runs in `afterAll` hooks automatically.

For a full reset, you can drop and recreate the test database:

```bash
dropdb devicedestination_test
createdb devicedestination_test
DATABASE_URL=$TEST_DATABASE_URL npx drizzle-kit migrate
```

## Test helpers and failure injection setup

### Test helpers (`tests/helpers/setup.ts`)

The setup module provides:

| Helper | Purpose |
|---|---|
| `hasTestDb()` | Returns `true` if `TEST_DATABASE_URL` is set |
| `getTestDb()` | Returns a Drizzle instance connected to the test database |
| `setupTestEnv()` | Sets `NODE_ENV=test`, overrides `DATABASE_URL`, sets synthetic Razorpay/auth secrets |
| `teardownTestEnv(snapshot)` | Restores original environment variables |
| `snapshotEnv()` | Captures current env values for later restoration |
| `seedProduct()` | Creates a published product with verified pricing |
| `seedInventory()` | Creates an inventory row for a product |
| `seedOrderWithPayment()` | Creates a full order with customer, address, items, and payment |
| `seedCustomer()` / `seedAddress()` / `seedBrand()` / `seedCategory()` | Create individual entity rows |
| `cleanupTestData()` | Deletes all test-prefix rows from all tables |
| `testId(label)` | Generates a unique test identifier (`itest_<label>_<uuid8>`) |
| `uniqueIdempotencyKey()` | Generates a unique checkout idempotency key |
| `uniqueProviderEventId()` | Generates a unique webhook event ID |
| `delay(ms)` | Async sleep for timing-dependent tests |

### Failure injection (`tests/helpers/failure-injection.ts`)

See [Backend Failure Recovery](backend-failure-recovery.md#failure-injection-system) for the full documentation of the 7 failure points and the dependency-injection mechanism.

Key usage in tests:

```typescript
import { injectFailure, NO_FAILURE } from "@tests/helpers/failure-injection";

// In a test that wants to simulate Razorpay failure:
const injection = injectFailure("razorpay_order_creation");

// In a test that runs normally:
const injection = NO_FAILURE;
```

The failure injection module asserts `NODE_ENV === "test"` on every call, ensuring it can never be activated in production.
