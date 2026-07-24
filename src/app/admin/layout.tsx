import { requireAdmin } from "@/lib/admin-auth";

// Admin pages require runtime session and database access — never prerender.
export const dynamic = "force-dynamic";

/**
 * Fail-closed admin layout.
 *
 * Authorisation is delegated to {@link requireAdmin} — the single
 * authoritative admin layer used by every admin layout, page, server action,
 * route handler and data-loading function.
 *
 * When authentication is not fully configured (missing `DATABASE_URL`,
 * `BETTER_AUTH_SECRET`, or an empty `ADMIN_EMAILS` allowlist) this never
 * renders the dashboard and never queries operational data: `requireAdmin`
 * calls `notFound()` so the response is a generic 404 that does not confirm
 * the existence of an admin surface.
 *
 * When auth is configured but the visitor is unauthenticated, the call
 * redirects to `/login?next=/admin`. Authenticated customers are redirected
 * to `/account`. Approved admins receive the rendered children.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
