# Architecture

DeviceDestination uses Next.js App Router with Server Components by default. Interactive islands are limited to the cart, product gallery, system builder and forms.

## Data flow

1. `src/data/seed-products-source.ts` is the deterministic public migration source for the 19 existing products.
2. `src/data/catalog.ts` converts old rupee amounts to integer paise, applies audited model corrections and attaches exact local documents.
3. `scripts/seed.ts` upserts public data into normalized Neon/PostgreSQL tables.
4. `src/data/repository.ts` uses Neon when `DATABASE_URL` exists and the public seed fallback only for an unconfigured preview.
5. Confidential supplier costs are never represented in the public schema or client payloads.

## Commerce

The anonymous Zustand cart persists only product IDs and quantity. `/api/orders` validates the submitted IDs against trusted catalogue data and recalculates totals. A Razorpay order is created server-side, the callback signature is verified server-side, and the webhook signature is independently verified. A customer-facing success page requires a server-generated confirmation token.

## Accounts and admin

Better Auth uses the Drizzle adapter with secure cookies. Guest checkout is independent. The admin layout requires a valid session and an email in `ADMIN_EMAILS`; without production configuration, admin pages are non-mutating activation guides.

## Notifications

Enquiries use Zod, a honeypot and rate limiting. The server stores them in PostgreSQL and can send Resend and WhatsApp Cloud API notifications. Production refuses a fake success when neither storage nor notification delivery is configured.
