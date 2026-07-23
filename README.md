# DeviceDestination

Production-oriented ecommerce for CCTV, NVR and biometric hardware. The storefront is warm-white and tangerine, model-number-first, GST-safe and designed for buyers who should not need to understand every surveillance acronym before choosing a product.

## Screenshots

![DeviceDestination desktop storefront](docs/screenshots/storefront-desktop.png)

![DeviceDestination mobile storefront](docs/screenshots/storefront-mobile.png)

## What is implemented

- Editorial responsive homepage, requirement paths and guided CCTV system builder
- 19 preserved products with audited exact models, model-linked assets and legacy slug redirects
- Hyphen-insensitive exact-model search with an accessible desktop/mobile search overlay
- Persistent four-product comparison tray with shareable comparison URLs
- Product JSON-LD, breadcrumbs, metadata, exact-model specifications and downloads
- Persistent ID-only anonymous cart and guest checkout
- Integer-paise pricing, included-GST extraction and no double GST
- Razorpay order creation, callback/provider verification, amount checks and idempotent capture webhooks
- PDF tax-invoice generation plus independently tracked email and WhatsApp delivery
- Server-confirmed contact and quote workflows with Resend/WhatsApp activation
- Better Auth + Neon account architecture and protected admin gate
- Normalized Drizzle schema, deterministic public seed and build-blocking catalogue validator
- CSP, HSTS, input validation, rate limiting and secure confirmation tokens
- Unit, Playwright and Axe test foundations

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Motion, Radix UI, Zustand, Zod, React Hook Form, Drizzle ORM, Neon, Better Auth, Razorpay, Resend, Upstash, Vitest and Playwright.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without external credentials the storefront, cart, catalogue, validator and server-confirmed local test checkout work. Production refuses fake payment or enquiry success when the required services are not configured.

## Database

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

The public seed excludes confidential supplier cost. Production catalogue reads use Neon when `DATABASE_URL` is configured; the seed catalogue is the safe unconfigured-preview fallback.

## Validation and tests

```bash
npm run lint
npm run typecheck
npm test
npm run products:validate
npm run test:e2e
npm run build
```

## Environment variables

| Group          | Required for production       | Variables                                                                                                                                                        |
| -------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database       | Yes                           | `DATABASE_URL`                                                                                                                                                   |
| Authentication | For accounts/admin            | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAILS`                                                                                                          |
| Public URLs    | Yes                           | `NEXT_PUBLIC_SITE_URL`                                                                                                                                           |
| Price policy   | Recommended                   | `NEXT_PUBLIC_PRICE_MAX_AGE_DAYS`                                                                                                                                 |
| Business       | Before invoicing              | `BUSINESS_LEGAL_NAME`, `BUSINESS_GSTIN`                                                                                                                          |
| Razorpay       | For online payment            | `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`                                                               |
| Email          | For live enquiry/auth mail    | `RESEND_API_KEY`, `EMAIL_FROM`, `SALES_EMAIL`                                                                                                                    |
| WhatsApp       | Optional notification channel | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_ORDER_TEMPLATE_NAME`, `SALES_WHATSAPP_NUMBER`, `WHATSAPP_GRAPH_VERSION` |
| Rate limiting  | Required at scale             | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                                                                             |
| Files          | Optional admin uploads        | `BLOB_READ_WRITE_TOKEN`                                                                                                                                          |

Never commit `.env.local`.

## Activation order

1. Create Neon, migrate and seed.
2. Configure Better Auth and the production site URL.
3. Add Razorpay test keys and webhook, then exercise success/failure/retry.
4. Verify the Resend domain and WhatsApp template.
5. Run the full validation suite and deploy to Vercel.
6. Verify legal invoice identity, GSTIN (if applicable), price freshness and all notification destinations.

## Production services

- **Vercel:** import this repository as a new project, add the production variables from `.env.example`, set `NEXT_PUBLIC_SITE_URL`, and run the Neon migration and seed before directing traffic.
- **Razorpay:** begin with test keys and register `/api/webhooks/razorpay`; exercise capture, failure, dismissal, and retry before replacing them with live keys. Only a verified capture webhook marks an order paid.
- **Resend:** verify the sending domain, then configure `RESEND_API_KEY`, `EMAIL_FROM`, and `SALES_EMAIL` for live enquiry and authentication mail.
- **WhatsApp:** approve the notification template, then configure the access token, phone-number ID, template name, Graph version, and sales destination number.
- **Admin:** configure Neon and Better Auth, create a verified account, and add its normalized email address to `ADMIN_EMAILS`. The unconfigured interface is non-mutating.

Detailed steps live in [deployment](docs/deployment.md), [architecture](docs/architecture.md), [security](docs/security.md), [admin guide](docs/admin-guide.md) and [order operations](docs/order-operations.md).

## Source-data rules

Supplier prices, landed costs, private marketplace observations and the internal price-list PDF are confidential and excluded from Git. Exact-model official sources are listed in [public product sources](docs/public-product-sources.md); identity corrections are in [product source audit](docs/product-source-audit.md).

## Catalogue and price safety

`src/data/catalog.ts` is the deterministic public fallback. Every product records its exact model, canonical slug, model-linked images/documents, warranty, GST-inclusive integer-paise price, verification timestamp, availability and compatibility references. `npm run products:validate` fails on duplicate identity, missing assets, model-association errors, invalid pricing, missing core facts, or broken comparison/builder references.

Direct purchase requires `priceSourceStatus: "verified"`, a non-null tax-inclusive price, a `priceVerifiedAt` date inside `NEXT_PUBLIC_PRICE_MAX_AGE_DAYS` (30 by default), and an eligible stock state. Otherwise every surface changes to **Request latest price**, and cart, builder and server checkout reject the line. SF100 intentionally uses this state until its exact documentation and current price are confirmed.

To update a price safely, change the integer-paise selling price, set `priceSourceStatus` to `verified`, record a real ISO verification date, run the catalogue validator and the full test suite, then publish. To force quote-only handling, set `priceSourceStatus` to `request-price` and clear `priceVerifiedAt`.

## Search, comparison and cart

Search uses one shared normalizer for the overlay and catalogue, so case, spaces, underscores and hyphens do not change exact-model results. The comparison store keeps at most four product IDs in local storage; `/compare?ids=…` is the share format. The anonymous cart also stores IDs and quantities only. Product records and server-trusted database prices are resolved again at render and checkout time.

## Order, payment and notifications

The checkout orchestrator uses the saga pattern via `checkout_attempts` for idempotency — the same idempotency key returns the existing order, returns "processing" for in-progress attempts, or returns a retryable error for failed attempts. On any step failure (inventory reservation, Razorpay creation, or payment-row update), all previously completed steps are compensated: inventory is released, the order is cancelled, and the payment is marked failed.

The webhook handler verifies the Razorpay HMAC signature before trusting any payload, then durably records the event in `payment_webhook_events` for idempotency and recovery. The `finalizeCapturedPayment` function executes an 11-step pipeline where each step is independently idempotent (guarded by timestamps on the `payments` table). If a step fails, the event is recorded as `failed` and can be re-processed later — only the missing steps are executed on retry. Duplicate capture events are safe and return `duplicate_completed` without re-processing.

After capture, the server creates an invoice number and PDF, then attempts customer/business email and WhatsApp independently using deduplicated jobs. Notification failure never rolls back or changes the paid status; each channel has its own status. A token-protected order page exposes the real stored state and invoice download.

## Backend reliability improvements

The backend reliability hardening (`fix/backend-reliability-hardening` branch) introduces:

- **Webhook event deduplication** — every Razorpay webhook event is recorded in `payment_webhook_events` before processing, with a unique index on `provider_event_id` preventing duplicate work.
- **11-step idempotent payment processing** — each step is guarded by a timestamp on the `payments` table, so retries resume from the last completed step without re-doing finished work.
- **Checkout saga with idempotency** — `checkout_attempts` table tracks each checkout through its phases, compensating on failure and deduplicating by idempotency key.
- **Job deduplication** — `enqueueDeduplicatedJob` uses a partial unique index on `dedupe_key` to prevent duplicate invoice, email, and WhatsApp jobs for the same order.
- **Inventory exception handling** — when a payment is captured after reservation expiry and stock is unavailable, the order enters `inventory_exception` status for admin resolution.
- **System runs tracking** — each cron run is recorded in `system_runs` for operational visibility.
- **Integration tests with failure injection** — 7 dependency-injected failure points for test-only simulation of crashes at critical steps.

## Cron schedule

Vercel Cron now triggers `/api/internal/jobs/run` **daily at 02:00 UTC** (changed from every 5 minutes). For production-grade reliability, especially with 15-minute reservation expiry, an **external scheduler** (cron-job.org, EasyCron, or a self-hosted cron) must hit this endpoint every 5–10 minutes with `Authorization: Bearer <CRON_SECRET>`. Without an external scheduler, expired reservations and stuck payment processing will not be resolved promptly.

The cron run performs: job batch processing, inventory reservation expiry, payment reconciliation, and incomplete post-payment processing repair.

## Detailed documentation

The `docs/` directory contains detailed documentation:

- [Architecture](docs/architecture.md) — system overview, data flow, and new reliability components
- [Payment Processing](docs/payment-processing.md) — 11-step pipeline, webhook idempotency, missing-step recovery
- [Webhook Recovery](docs/webhook-recovery.md) — event recording, status flow, duplicate handling, reconciliation
- [Checkout Saga](docs/checkout-saga.md) — phases, idempotency keys, compensation, placeholder payment
- [Backend Failure Recovery](docs/backend-failure-recovery.md) — idempotent steps, timestamps, failure injection, recovery paths
- [Inventory Operations](docs/inventory-operations.md) — reservation lifecycle, atomic claims, compensation, cleanup
- [Job Runner](docs/job-runner.md) — deduplication, system runs, cron endpoint
- [CI Integration Tests](docs/ci-integration-tests.md) — CI workflow, test categories, local setup
- [Security](docs/security.md) — webhook verification, event recording, failure injection safety
- [Refund Operations](docs/refund-operations.md) — idempotent refund system
- [Backend Activation Checklist](docs/backend-activation-checklist.md) — deployment steps and verification

## Adding products and reviews

Add products only after verifying the exact manufacturer model, official URL, image association, warranty, specifications, documents, GST treatment and price evidence. Run `npm run products:validate` before import or deployment. Related and builder IDs must reference existing products. Do not add ratings or review counts until a verified review source and moderation workflow exist; the current UI intentionally publishes none.

## License

Private business application. No rights to manufacturer product imagery or documentation are transferred by this repository.
