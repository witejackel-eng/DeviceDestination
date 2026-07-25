import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { AuthOrderSummary } from "@/components/auth-order-summary";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { PasswordSignIn } from "@/components/auth-forms";
import { getSessionUser } from "@/lib/authz";
import { isAuthConfigured, isGoogleAuthConfigured } from "@/lib/auth";
import { postLoginRedirect } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = postLoginRedirect(params.next);
  const fromCheckout = next.startsWith("/checkout");

  const user = await getSessionUser();
  if (user) redirect(next);

  const googleReady = isAuthConfigured() && isGoogleAuthConfigured();

  return (
    <div className="container-standard py-12 sm:py-16">
      <div className="flex justify-center">
        <Brand />
      </div>

      <div
        className={`mx-auto mt-10 grid items-start gap-8 ${fromCheckout ? "lg:max-w-5xl lg:grid-cols-[1.05fr_0.95fr]" : "max-w-md"}`}
      >
        <div className="surface-card p-6 sm:p-8">
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">
            {fromCheckout ? "Continue to checkout" : "Sign in"}
          </h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">
            {fromCheckout
              ? "Sign in securely to complete your purchase, receive your GST invoice and track your delivery."
              : "Sign in to see your orders, invoices and saved delivery addresses."}
          </p>

          <div className="mt-7">
            {googleReady ? (
              <GoogleSignInButton next={next} />
            ) : (
              <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6">
                <strong>Google sign-in is not configured in this environment.</strong> Add{" "}
                <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> (plus the Better
                Auth and database variables) to enable it.
              </p>
            )}
          </div>

          {params.error === "google" && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-[var(--danger)]" role="alert">
              Google sign-in did not complete. Please try again.
            </p>
          )}

          <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
            DeviceDestination uses your name and email for your account, invoices and order
            communication.
          </p>

          {isAuthConfigured() && (
            <details className="group mt-7 border-t border-[var(--line)] pt-6">
              <summary className="cursor-pointer list-none text-sm font-bold underline underline-offset-4">
                Use an email address and password instead
              </summary>
              <div className="mt-5">
                <PasswordSignIn next={next} />
              </div>
            </details>
          )}

          <p className="mt-7 border-t border-[var(--line)] pt-6 text-xs leading-5 text-[var(--muted)]">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              privacy policy
            </Link>
            .
          </p>
        </div>

        {fromCheckout && (
          <div className="lg:sticky lg:top-28">
            <AuthOrderSummary />
          </div>
        )}
      </div>
    </div>
  );
}
