import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { verifyOrderConfirmationToken } from "@/lib/order-token";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};
type Params = Promise<{ orderNumber: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default async function OrderSuccessPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { orderNumber } = await params;
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const testMode = query.mode === "test";
  const verified = verifyOrderConfirmationToken(orderNumber, token);
  if (!verified)
    return (
      <div className="container-reading section-space !pt-14">
        <div className="surface-card p-8 text-center">
          <CircleAlert className="mx-auto text-[var(--danger)]" size={42} />
          <h1 className="mt-6 font-display text-4xl font-semibold">
            Confirmation link is invalid.
          </h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">
            No payment or order status is being claimed on this page. Contact support if you
            completed payment.
          </p>
          <Link href="/contact" className="button-primary mt-7">
            Contact support
          </Link>
        </div>
      </div>
    );
  return (
    <div className="container-reading section-space !pt-14">
      <div className="surface-card p-8 text-center sm:p-12">
        <CheckCircle2 className="mx-auto text-[var(--success)]" size={48} />
        <p className="eyebrow mt-7">Server-confirmed reference</p>
        <h1 className="mt-4 font-display text-5xl font-semibold">Order received.</h1>
        <p className="mt-5 text-lg text-[var(--muted)]">
          Reference <strong className="text-[var(--ink)]">{orderNumber}</strong>
        </p>
        {testMode ? (
          <p className="mt-4 rounded-xl bg-[var(--tangerine-soft)] p-4 text-sm">
            Local test mode confirmed the order workflow. No real payment was captured.
          </p>
        ) : (
          <p className="mt-4 leading-7 text-[var(--muted)]">
            The payment response passed server signature verification. Webhook reconciliation
            remains the final payment record.
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/order/${orderNumber}?token=${token}`} className="button-primary">
            View order status
          </Link>
          <Link href="/products" className="button-secondary">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
