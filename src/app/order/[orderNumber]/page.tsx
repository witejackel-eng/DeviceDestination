import type { Metadata } from "next";
import Link from "next/link";
import { verifyOrderConfirmationToken } from "@/lib/order-token";
export const metadata: Metadata = {
  title: "Order status",
  robots: { index: false, follow: false },
};
type Params = Promise<{ orderNumber: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { orderNumber } = await params;
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const verified = verifyOrderConfirmationToken(orderNumber, token);
  return (
    <div className="container-reading section-space !pt-14">
      <p className="eyebrow">Order status</p>
      <h1 className="display-section mt-4">{verified ? orderNumber : "Reference required"}</h1>
      <div className="surface-card mt-8 p-8">
        {verified ? (
          <>
            <p className="font-display text-3xl font-semibold">Confirmation recorded</p>
            <p className="mt-4 leading-7 text-[var(--muted)]">
              For live orders, fulfilment and payment status are read from the production database
              after activation. Quote this reference when contacting support.
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-3xl font-semibold">
              Use your secure confirmation link.
            </p>
            <p className="mt-4 text-[var(--muted)]">
              A bare order number does not reveal customer or payment data.
            </p>
          </>
        )}
        <Link href="/contact" className="button-secondary mt-6">
          Contact order support
        </Link>
      </div>
    </div>
  );
}
