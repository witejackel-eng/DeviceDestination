/**
 * Public catalogue-state treatments (M2B).
 *
 * Server-rendered, no client JavaScript. Deliberately says nothing about
 * publication state, integrity validation, databases or internal diagnostics —
 * a customer sees a shop that is quiet or unverified, never an operations
 * report.
 */

import Link from "next/link";
import { Info } from "lucide-react";

/**
 * Shown when the database is authoritative and deliberately publishing nothing
 * — either no published products, or none that passed integrity validation.
 * Never accompanied by the static fallback catalogue.
 */
export function CatalogueUnavailable({ className = "" }: { className?: string }) {
  return (
    <div className={`surface-card grid min-h-[360px] place-content-center p-8 text-center ${className}`}>
      <h2 className="font-display text-3xl font-semibold">
        Products are temporarily unavailable online.
      </h2>
      <p className="mt-3 max-w-md text-[var(--text-muted)]">
        Contact us for product assistance and we will help you directly.
      </p>
      <Link href="/contact" className="button-primary mt-6 justify-self-center">
        Contact product support
      </Link>
    </div>
  );
}

/**
 * Shown when browsing continues from static fallback because the catalogue
 * could not be verified this request. Restrained by design: browsing stays
 * enabled and no claim is made that prices or stock are current.
 *
 * Checkout independently re-reads price from the database and rejects when it
 * cannot, so this is an honesty notice, not the safety mechanism.
 */
export function CatalogueUnverifiedNotice({ className = "" }: { className?: string }) {
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)] ${className}`}
    >
      <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        Live price and availability verification is temporarily unavailable. Product details shown
        here may not reflect current pricing or stock — please confirm before ordering.
      </span>
    </p>
  );
}
