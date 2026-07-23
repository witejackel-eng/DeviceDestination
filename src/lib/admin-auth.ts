import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Session, User } from "better-auth";
import { getAuth, isAuthConfigured } from "@/lib/auth";
import { isAdminEmail } from "@/lib/env";

export type AdminContext = {
  user: User;
  session: Session;
  email: string;
  userId: string;
  role: string;
};

function isAdminRole(role: unknown): role is "catalogue_manager" | "operations" | "admin" {
  return role === "catalogue_manager" || role === "operations" || role === "admin";
}

/**
 * Resolve the current admin session server-side. Used by every admin Server
 * Action and every admin Server Component. Throws on unconfigured auth so the
 * caller can produce a clean error instead of an undefined-state mutation.
 *
 * - Returns the admin context on success.
 * - Redirects to /login if no session (for page-level callers).
 * - Throws `AdminForbiddenError` if the session user is not an admin.
 */
export async function requireAdmin(): Promise<AdminContext> {
  if (!isAuthConfigured()) {
    throw new AdminForbiddenError("Authentication is not configured.");
  }
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login?next=/admin");
  }
  const email = session.user.email.toLowerCase();
  const adminByEnv = isAdminEmail(email);
  const role = (session.user as { role?: string }).role ?? "customer";
  const adminByRole = isAdminRole(role);
  if (!adminByEnv && !adminByRole) {
    redirect("/account");
  }
  return {
    user: session.user,
    session: session.session,
    email,
    userId: session.user.id,
    role,
  };
}

/**
 * Variant of {@link requireAdmin} that returns an error result instead of
 * redirecting. Use inside Server Actions where you want to return a structured
 * failure to the client.
 */
export async function resolveAdmin(): Promise<
  { ok: true; context: AdminContext } | { ok: false; reason: string; status: number }
> {
  if (!isAuthConfigured()) {
    return { ok: false, reason: "Authentication is not configured.", status: 503 };
  }
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, reason: "Sign in required.", status: 401 };
  }
  const email = session.user.email.toLowerCase();
  const role = (session.user as { role?: string }).role ?? "customer";
  if (!isAdminEmail(email) && !isAdminRole(role)) {
    return { ok: false, reason: "Forbidden.", status: 403 };
  }
  return {
    ok: true,
    context: { user: session.user, session: session.session, email, userId: session.user.id, role },
  };
}

export class AdminForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminForbiddenError";
  }
}
