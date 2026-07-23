import type { Metadata } from "next";
import Link from "next/link";
import { verifyOrderConfirmationToken } from "@/lib/order-token";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { eq } from "drizzle-orm";
import { orders } from "@/db/schema";
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
  const record =
    verified && isDatabaseConfigured()
      ? (
          await getDb()
            .select({
              status: orders.status,
              invoiceNumber: orders.invoiceNumber,
              emailStatus: orders.emailStatus,
              whatsappStatus: orders.whatsappStatus,
            })
            .from(orders)
            .where(eq(orders.orderNumber, orderNumber))
            .limit(1)
        )[0]
      : null;
  return (
    <div className="container-reading section-space !pt-14">
      <p className="eyebrow">Order status</p>
      <h1 className="section-title mt-4">{verified ? orderNumber : "Reference required"}</h1>
      <div className="surface-card mt-8 p-8">
        {verified ? (
          <>
            <p className="font-display text-2xl font-semibold">
              {record ? `Order ${record.status.replaceAll("_", " ")}` : "Confirmation recorded"}
            </p>
            <p className="mt-4 leading-7 text-[var(--text-muted)]">
              {record
                ? `Email: ${record.emailStatus}. WhatsApp: ${record.whatsappStatus}.`
                : "The secure reference is valid. Live fulfilment details appear after production storage is activated."}
            </p>
            {record?.invoiceNumber && (
              <a
                href={`/api/orders/${orderNumber}/invoice?token=${encodeURIComponent(token)}`}
                className="button-primary mt-6"
              >
                Download tax invoice
              </a>
            )}
          </>
        ) : (
          <>
            <p className="font-display text-2xl font-semibold">
              Use your secure confirmation link.
            </p>
            <p className="mt-4 text-[var(--text-muted)]">
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
