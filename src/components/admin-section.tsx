import Link from "next/link";

/** Page frame shared by every admin route: title, optional actions, content. */
export function AdminPage({
  title,
  description,
  actions,
  back,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1240px]">
      {back && (
        <Link
          href={back.href}
          className="mb-4 inline-flex min-h-10 items-center text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] font-bold leading-tight sm:text-[42px]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="mt-7">{children}</div>
    </div>
  );
}

/** Honest empty state used wherever the production database is not connected. */
export function AdminNotConnected({ what }: { what: string }) {
  return (
    <div className="rounded-[16px] border border-dashed border-[var(--line)] p-10 text-center">
      <p className="font-display text-2xl font-semibold">{what} needs the production database.</p>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">
        Configure <code>DATABASE_URL</code> and run the migration and seed. No sample figures are
        shown here, because an operations screen that invents numbers is worse than an empty one.
      </p>
    </div>
  );
}

export function AdminCard({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[16px] border border-[var(--line)] bg-white ${className}`}>
      {title && (
        <header className="border-b border-[var(--line)] px-5 py-3.5">
          <h2 className="text-sm font-bold uppercase tracking-[0.06em] text-[var(--muted)]">
            {title}
          </h2>
        </header>
      )}
      {children}
    </section>
  );
}

export function AdminMetric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass = {
    default: "",
    warning: "text-amber-700",
    danger: "text-[var(--danger)]",
  }[tone];
  return (
    <div className="rounded-[14px] border border-[var(--line)] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--muted)]">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

/** Tables scroll inside their own container so the admin page never scrolls sideways. */
export function AdminTableScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function AdminStatus({ status }: { status: string }) {
  const tone: Record<string, string> = {
    published: "border-green-200 bg-green-50 text-[var(--success)]",
    paid: "border-green-200 bg-green-50 text-[var(--success)]",
    captured: "border-green-200 bg-green-50 text-[var(--success)]",
    delivered: "border-green-200 bg-green-50 text-[var(--success)]",
    draft: "border-[var(--line)] bg-[var(--canvas-alt)] text-[var(--muted)]",
    archived: "border-[var(--line)] bg-[var(--canvas-alt)] text-[var(--muted)]",
    payment_pending: "border-amber-200 bg-amber-50 text-amber-800",
    pending: "border-amber-200 bg-amber-50 text-amber-800",
    failed: "border-red-200 bg-red-50 text-[var(--danger)]",
    cancelled: "border-red-200 bg-red-50 text-[var(--danger)]",
    refunded: "border-red-200 bg-red-50 text-[var(--danger)]",
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.05em] ${tone[status] ?? "border-[var(--line)] bg-white text-[var(--ink-soft)]"}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
