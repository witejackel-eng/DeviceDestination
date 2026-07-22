import Link from "next/link";
import { isAuthConfigured } from "@/lib/auth";
export function AdminSection({
  title,
  description,
  warnings,
}: {
  title: string;
  description: string;
  warnings: string[];
}) {
  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin" className="text-sm font-bold underline">
        ← Admin
      </Link>
      <p className="eyebrow mt-8">Operations</p>
      <h1 className="display-section mt-4">{title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">{description}</p>
      <div className="surface-card mt-10 overflow-hidden">
        <div className="border-b border-[var(--line)] p-6">
          <h2 className="font-display text-2xl font-semibold">Activation checklist</h2>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {warnings.map((warning) => (
            <li key={warning} className="p-5 text-sm">
              {warning}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-5 text-sm text-[var(--muted)]">
        Status: {isAuthConfigured() ? "authenticated environment" : "configuration-only preview"}.
        Mutations are intentionally unavailable without the production database and role setup.
      </p>
    </div>
  );
}
