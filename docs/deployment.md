# Deployment

## Vercel and Neon

1. Create a Neon PostgreSQL database and set `DATABASE_URL` in local, preview and production environments.
2. Run `npm run db:generate`, then `npm run db:migrate` against the intended database.
3. Run `npm run db:seed`. This writes only public catalogue information.
4. Create a Vercel project from `witejackel-eng/DeviceDestination` and add the environment variables from `.env.example`.
5. Set `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_URL` and the application domain consistently for each environment.

## Razorpay

Use test keys first. Configure `/api/webhooks/razorpay` in Razorpay and set its secret as `RAZORPAY_WEBHOOK_SECRET`. Test successful, failed and dismissed checkout. Move to live keys only after signature verification and webhook reconciliation are visible in production records.

## Resend and WhatsApp

Verify the sending domain in Resend, then set `EMAIL_FROM` and `SALES_EMAIL`. Create and approve a WhatsApp template whose body parameters match reference, name, mobile and message; then set the phone-number ID, token, template and destination number.

## Final checks

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run products:validate`, `npm run test:e2e` and `npm run build`. Confirm canonical URLs and CSP against the production domain.
