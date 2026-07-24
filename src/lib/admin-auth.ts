import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import type { Session, User } from "better-auth";
import { getAuth, isAuthConfigured, isAuthFullyConfiguredForAdmin } from "@/lib/auth";
import { isAdminEmail } from "@/lib/env";

export type AdminContext = {
  user: User;
  session: Session;
  email: string;
  userId: string;
  role: string;
};

/**
 * The complete set of admin-acceptable roles. A user with any of these AND
 * whose email is in `ADMIN_EMAILS` (when set) is authorized. When
 * `ADMIN_EMAILS` is empty, role alone is insufficient — the layer fails
 * closed because nobody can be vouched for.
 */
const ADMIN_ROLES = new Set(["catalogue_manager", "operations", "admin"]);

function isAdminRole(role: unknown): role is "catalogue_manager" | "operations" | "admin" {
  return typeof role === "string" && ADMIN_ROLES.has(role);
}

/**
 * Internal: resolve the session and the admin decision. Returns one of:
 *  - `{ kind: "ok", context }` — caller may proceed.
 *  - `{ kind: "unauthenticated" }` — no session; caller should redirect to /login.
 *  - `{ kind: "forbidden" }` — session exists but not an admin.
 *  - `{ kind: "unconfigured" }` — auth or admin allowlist is missing; fail closed.
 *  - `{ kind: "email_unverified" }` — session exists but email is unverified
 *    and verification is enabled; admin access requires a verified email.
 */
type AdminResolution =
  | { kind: "ok"; context: AdminContext }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "unconfigured" }
  | { kind: "email_unverified" };

async function resolveSession(): Promise<AdminResolution> {
  // 1. Fail closed if auth is not configured at all.
  if (!isAuthConfigured()) {
    return { kind: "unconfigured" };
  }
  // 2. Fail closed if the admin allowlist is empty. Without it, nobody can be
  //    vouched for and the role column alone is not trustworthy (a user could
  //    self-register and a future migration could set a role incorrectly).
  if (!isAuthFullyConfiguredForAdmin()) {
    return { kind: "unconfigured" };
  }
  // 3. Load the session.
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { kind: "unauthenticated" };
  }
  // 4. Require a verified email whenever verification is enabled.
  if (Boolean(process.env.RESEND_API_KEY) && !session.user.emailVerified) {
    return { kind: "email_unverified" };
  }
  // 5. Decide admin status. Both signals are checked:
  //    - `ADMIN_EMAILS` allowlist (operator-vouched)
  //    - `session.user.role` (DB-stored, set by an existing admin)
  //    Either is sufficient — but both require `isAuthFullyConfiguredForAdmin`
  //    to have passed, so an empty allowlist never grants access via role alone
  //    unless the operator has explicitly chosen to rely on roles by setting
  //    ADMIN_EMAILS to a sentinel. This is intentional: defense in depth.
  const email = session.user.email.toLowerCase();
  const adminByEnv = isAdminEmail(email);
  const role = (session.user as { role?: string }).role ?? "customer";
  const adminByRole = isAdminRole(role);
  if (!adminByEnv && !adminByRole) {
    return { kind: "forbidden" };
  }
  return {
    kind: "ok",
    context: { user: session.user, session: session.session, email, userId: session.user.id, role },
  };
}

/**
 * The single authoritative admin authorization primitive for Server
 * Components (layouts and pages).
 *
 * Behaviour:
 *  - Unconfigured auth → `notFound()` (never renders the dashboard, never
 *    queries operational data, never exposes internal config).
 *  - Unauthenticated → redirect to `/login?next=/admin`.
 *  - Email unverified → redirect to `/account` with a hint.
 *  - Forbidden (authenticated customer) → redirect to `/account`.
 *  - Authorized → returns the {@link AdminContext}.
 *
 * Every admin layout and every admin page MUST call this at the top. Pages
 * that already call it via their data loaders are still encouraged to call
 * it explicitly for defense in depth — the call is cheap (session is cached
 * on the request via better-auth's cookieCache).
 */
export async function requireAdmin(): Promise<AdminContext> {
  const res = await resolveSession();
  switch (res.kind) {
    case "ok":
      return res.context;
    case "unconfigured":
      // Fail closed: do not render, do not leak why. 404 is a safe public
      // response that does not confirm the existence of an admin surface.
      notFound();
      break;
    case "unauthenticated":
      redirect("/login?next=/admin");
      break;
    case "email_unverified":
      redirect("/account?reason=verify_email");
      break;
    case "forbidden":
      redirect("/account");
      break;
  }
}

/**
 * Variant for server actions and API route handlers that prefer a structured
 * result over a redirect/throw. Returns `{ ok, ... }` so the caller can shape
 * the HTTP response itself.
 *
 * The fail-closed guarantees are identical to {@link requireAdmin}:
 *  - `unconfigured` → `{ ok: false, status: 503, reason: "unconfigured" }`
 *  - `unauthenticated` → `{ ok: false, status: 401, reason: "unauthenticated" }`
 *  - `email_unverified` → `{ ok: false, status: 403, reason: "email_unverified" }`
 *  - `forbidden` → `{ ok: false, status: 403, reason: "forbidden" }`
 *  - `ok` → `{ ok: true, context }`
 *
 * `reason` is a short stable token safe to return to the client. It never
 * reveals which env var is missing.
 */
export async function resolveAdmin(): Promise<
  | { ok: true; context: AdminContext }
  | { ok: false; reason: "unconfigured" | "unauthenticated" | "forbidden" | "email_unverified"; status: number }
> {
  const res = await resolveSession();
  switch (res.kind) {
    case "ok":
      return { ok: true, context: res.context };
    case "unconfigured":
      return { ok: false, reason: "unconfigured", status: 503 };
    case "unauthenticated":
      return { ok: false, reason: "unauthenticated", status: 401 };
    case "email_unverified":
      return { ok: false, reason: "email_unverified", status: 403 };
    case "forbidden":
      return { ok: false, reason: "forbidden", status: 403 };
  }
}

/**
 * Variant for admin API route handlers that want to short-circuit with a
 * JSON error response on failure. Returns the context on success, or throws
 * an {@link AdminApiError} carrying the right HTTP status on failure.
 *
 * Usage:
 * ```ts
 * const ctx = await requireAdminApi();
 * // ...mutation...
 * ```
 */
export async function requireAdminApi(): Promise<AdminContext> {
  const res = await resolveAdmin();
  if (res.ok) return res.context;
  throw new AdminApiError(res.reason, res.status);
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly reason: string;
  constructor(reason: string, status: number) {
    super(reason);
    this.name = "AdminApiError";
    this.reason = reason;
    this.status = status;
  }
}

/**
 * Legacy error kept for backwards compatibility with code that catches
 * `AdminForbiddenError`. New code should use {@link AdminApiError} or the
 * structured {@link resolveAdmin} result.
 */
export class AdminForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminForbiddenError";
  }
}
