import Link from "next/link";

/**
 * Shown when the preview environment has no database or Better Auth secret.
 * Accounts, orders and admin all depend on the same configuration, so this
 * single notice explains it once rather than in each route.
 */
export function UnconfiguredAccountNotice() {
  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Your details</p>
      <h1 className="display-section mt-4">Account.</h1>
      <div className="surface-card mt-10 max-w-2xl p-8">
        <h2 className="font-display text-3xl font-semibold">
          Accounts activate with the production database.
        </h2>
        <p className="mt-4 leading-7 text-[var(--muted)]">
          Add the documented <code>DATABASE_URL</code>, <code>BETTER_AUTH_SECRET</code> and Google
          OAuth variables to enable Google sign-in, order history, invoices and saved addresses.
          Browsing, search, comparison and the cart work without them.
        </p>
        <Link href="/products" className="button-primary mt-6">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
