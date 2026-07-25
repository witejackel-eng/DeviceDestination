import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAuth, isAuthConfigured } from "@/lib/auth";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { users } from "@/db/schema";

/**
 * Roles are server-owned. A Google (or password) sign-in only ever creates a
 * `customer`; elevation happens through the database `users.role` column or the
 * server-only `ADMIN_EMAILS` bootstrap allowlist. This module reaches for
 * `next/headers`, so importing it from a client component is a build error.
 */
export type Role = "customer" | "operations" | "catalogue_manager" | "admin" | "owner";

export type Capability =
  | "admin.view"
  | "catalogue.manage"
  | "inventory.manage"
  | "orders.view"
  | "orders.manage"
  | "customers.view"
  | "settings.manage";

const capabilitiesByRole: Record<Role, Capability[]> = {
  customer: [],
  operations: ["admin.view", "orders.view", "orders.manage", "inventory.manage"],
  catalogue_manager: ["admin.view", "catalogue.manage", "inventory.manage"],
  admin: [
    "admin.view",
    "catalogue.manage",
    "inventory.manage",
    "orders.view",
    "orders.manage",
    "customers.view",
  ],
  owner: [
    "admin.view",
    "catalogue.manage",
    "inventory.manage",
    "orders.view",
    "orders.manage",
    "customers.view",
    "settings.manage",
  ],
};

export function roleLabel(role: Role) {
  return {
    customer: "Customer",
    operations: "Staff — operations",
    catalogue_manager: "Staff — catalogue",
    admin: "Admin",
    owner: "Owner",
  }[role];
}

export function can(role: Role, capability: Capability) {
  return capabilitiesByRole[role].includes(capability);
}

/** Server-only bootstrap allowlist. Never import this into client code. */
function bootstrapOwners() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
};

/**
 * Resolves the signed-in user and their authoritative role. The role is read
 * from the database on every call rather than trusted from the session payload,
 * so a revoked role takes effect immediately.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isAuthConfigured()) return null;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const email = session.user.email.toLowerCase();
  let role: Role = "customer";

  if (isDatabaseConfigured()) {
    const rows = await getDb()
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (rows[0]?.role) role = rows[0].role as Role;
  }
  if (bootstrapOwners().includes(email)) role = "owner";

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
    role,
  };
}

/** Redirects to sign-in (preserving intent) when there is no session. */
export async function requireUser(next: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/**
 * Gate for every /admin route and admin server action. A customer who guesses an
 * admin URL is redirected to their own account — navigation is never the control.
 */
export async function requireCapability(
  capability: Capability,
  next: string,
): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!can(user.role, capability)) redirect("/account");
  return user;
}

/** Non-redirecting variant for API routes and server actions. */
export async function authorize(capability: Capability) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, status: 401, user: null };
  if (!can(user.role, capability)) return { ok: false as const, status: 403, user };
  return { ok: true as const, status: 200, user };
}
