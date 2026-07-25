import Link from "next/link";
import { AccountNav } from "@/components/account-nav";
import type { SessionUser } from "@/lib/authz";
import { can } from "@/lib/authz";

/**
 * Calm, transactional frame for every customer account route. Deliberately not
 * the admin shell — a customer never sees merchant navigation.
 */
export function AccountShell({
  user,
  title,
  eyebrow = "Your account",
  description,
  children,
}: {
  user: SessionUser;
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-standard py-12 sm:py-16">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display-section mt-4">{title}</h1>
      {description && (
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">{description}</p>
      )}

      {can(user.role, "admin.view") && (
        <Link
          href="/admin"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold"
        >
          You have merchant access — open the admin dashboard →
        </Link>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    paid: "bg-green-50 text-[var(--success)] border-green-200",
    delivered: "bg-green-50 text-[var(--success)] border-green-200",
    shipped: "bg-[var(--sky)] text-[var(--ink)] border-[var(--line)]",
    processing: "bg-[var(--sky)] text-[var(--ink)] border-[var(--line)]",
    payment_pending: "bg-amber-50 text-amber-800 border-amber-200",
    pending: "bg-amber-50 text-amber-800 border-amber-200",
    cancelled: "bg-red-50 text-[var(--danger)] border-red-200",
    refunded: "bg-red-50 text-[var(--danger)] border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${tone[status] ?? "border-[var(--line)] bg-[var(--canvas-alt)] text-[var(--muted)]"}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
