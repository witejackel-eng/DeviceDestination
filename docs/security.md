# Security

- No credentials or supplier costs are committed.
- Database, Redis, Resend and Razorpay clients are created lazily after environment checks.
- Customer input is validated on both client and server; server validation is authoritative.
- Cart totals are recalculated using trusted catalogue prices.
- Payment and webhook HMAC signatures use timing-safe comparison.
- Confirmation pages require a server-signed token rather than trusting a URL or client callback.
- Auth uses HTTP-only Better Auth cookies; production cookies are secure.
- Contact and checkout endpoints use rate limits and honeypots.
- CSP, HSTS, frame restrictions, MIME sniffing protection, referrer and permissions policies are configured.
- Admin access requires both an authenticated session and `ADMIN_EMAILS` membership.
- Product downloads are static exact-model files; the validator rejects missing paths.

Upstash is required for distributed production rate limiting. The in-memory fallback exists only to keep local development testable.

Run `npm audit` before every release and assess transitive findings by reachable production path rather than suppressing them. The 22 July 2026 audit reported no high or critical findings and nine moderate transitive findings: the development-only Drizzle toolchain carries the unfixed esbuild development-server advisory, while Next.js carries the unfixed PostCSS stringify advisory. Recheck both after dependency upgrades and before deployment.
