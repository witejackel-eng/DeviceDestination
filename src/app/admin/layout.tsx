import Link from "next/link";
import { AdminNav, adminNavGroups } from "@/components/admin-nav";
import { AdminSignOut } from "@/components/admin-sign-out";
import { DDMark } from "@/components/dd-mark";
import { isAuthConfigured } from "@/lib/auth";
import { can, requireCapability, roleLabel, type SessionUser } from "@/lib/authz";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Without a database and auth secret there is no role store, so the admin
  // interface is unreachable rather than open. Never fall through to `children`.
  if (!isAuthConfigured()) return <NotConfigured />;

  // Server-side capability check on every admin render. Hidden navigation is
  // presentation, not access control — each admin route re-checks as well.
  const user: SessionUser = await requireCapability("admin.view", "/admin");

  const allowed = adminNavGroups
    .flatMap((group) => group.items)
    .filter((item) => can(user.role, item.capability))
    .map((item) => item.href);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex w-full max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--line)] bg-white p-4 lg:flex">
          <Link href="/admin" className="mb-7 flex items-center gap-2.5 px-2">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--tangerine)] p-1.5">
              <DDMark tone="dark" className="h-full w-full" />
            </span>
            <span className="font-display text-[17px] font-extrabold tracking-[-0.02em]">
              Admin
            </span>
          </Link>
          <AdminNav allowed={allowed} />
          <div className="mt-auto border-t border-[var(--line)] pt-4">
            <p className="truncate px-3 text-sm font-bold">{user.name || user.email}</p>
            <p className="truncate px-3 text-xs text-[var(--muted)]">{roleLabel(user.role)}</p>
            <div className="mt-3 grid gap-0.5">
              <Link
                href="/"
                className="flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--canvas-alt)] hover:text-[var(--ink)]"
              >
                View storefront
              </Link>
              <AdminSignOut />
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="border-b border-[var(--line)] p-4 lg:hidden">
            <AdminNav allowed={allowed} />
          </div>
          <div className="p-5 sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="container-reading section-space !pt-14">
      <h1 className="display-section">Admin is not available.</h1>
      <p className="mt-5 leading-8 text-[var(--muted)]">
        The admin dashboard requires <code>DATABASE_URL</code> and <code>BETTER_AUTH_SECRET</code>{" "}
        so that roles can be read from the database. Until both are configured this interface stays
        closed rather than open in a reduced state.
      </p>
      <Link href="/" className="button-primary mt-8">
        Back to the storefront
      </Link>
    </div>
  );
}
