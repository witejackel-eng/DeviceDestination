import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, MessageCircle, RotateCcw } from "lucide-react";
import { AccountShell, StatusPill } from "@/components/account-shell";
import { UnconfiguredAccountNotice } from "@/components/account-panel";
import { siteConfig } from "@/config/site";
import { getOrderForUser } from "@/data/orders-repository";
import { isAuthConfigured } from "@/lib/auth";
import { requireUser } from "@/lib/authz";
import { extractIncludedGst, formatPrice } from "@/lib/products";

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false, follow: false },
};

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  if (!isAuthConfigured()) return <UnconfiguredAccountNotice />;
  const { orderId } = await params;
  const user = await requireUser(`/account/orders/${orderId}`);

  // Scoped to this user inside the query — an order number belonging to someone
  // else is indistinguishable from one that does not exist.
  const order = await getOrderForUser(user.id, orderId);
  if (!order) notFound();

  const invoiceReady = order.status === "paid" && Boolean(order.invoiceNumber);

  return (
    <AccountShell user={user} eyebrow="Order" title={order.orderNumber}>
      <Link
        href="/account/orders"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-bold underline"
      >
        <ArrowLeft size={15} /> All orders
      </Link>

      <div className="mt-5 grid gap-5">
        <section className="surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--muted)]">
                Placed{" "}
                {order.createdAt.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Payment: {order.paymentStatus ?? "not started"}
              </p>
            </div>
            <StatusPill status={order.status} />
          </div>

          <ul className="mt-6 grid gap-4 border-t border-[var(--line)] pt-6">
            {order.items.map((item) => {
              const lineTotal = item.unitPriceInclGstPaise * item.quantity;
              return (
                <li key={item.id} className="flex flex-wrap justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--tangerine-text)]">{item.model}</p>
                    {item.productSlug ? (
                      <Link href={`/products/${item.productSlug}`} className="font-semibold underline">
                        {item.title}
                      </Link>
                    ) : (
                      <p className="font-semibold">{item.title}</p>
                    )}
                    <p className="text-sm text-[var(--muted)]">
                      {formatPrice(item.unitPriceInclGstPaise)} × {item.quantity} · includes{" "}
                      {formatPrice(extractIncludedGst(lineTotal, item.gstRateBasisPoints))} GST
                    </p>
                  </div>
                  <strong>{formatPrice(lineTotal)}</strong>
                </li>
              );
            })}
          </ul>

          <dl className="mt-6 grid gap-2 border-t border-[var(--line)] pt-6 text-sm">
            <Row label="Subtotal" value={formatPrice(order.subtotalInclGstPaise)} />
            <Row label="Delivery" value={formatPrice(order.shippingPaise)} />
            <Row
              label="Installation"
              value={order.installationRequested ? "Requested — quoted separately" : "Not included"}
            />
            <div className="flex justify-between border-t border-[var(--line)] pt-3 text-lg">
              <dt className="font-bold">Total paid</dt>
              <dd className="font-bold">{formatPrice(order.totalInclGstPaise)}</dd>
            </div>
            <Row
              label="Includes GST"
              value={formatPrice(order.includedGstPaise)}
              muted
            />
          </dl>
        </section>

        <div className="grid gap-5 sm:grid-cols-2">
          <section className="surface-card p-6">
            <p className="eyebrow">Delivery address</p>
            {order.address ? (
              <address className="mt-3 not-italic leading-7">
                {order.customer.name}
                <br />
                {order.address.line1}
                {order.address.line2 && (
                  <>
                    <br />
                    {order.address.line2}
                  </>
                )}
                <br />
                {order.address.city}, {order.address.state} {order.address.pincode}
                <br />
                {order.customer.mobile}
              </address>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">No address recorded.</p>
            )}
          </section>

          <section className="surface-card p-6">
            <p className="eyebrow">Invoice and GST</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {order.customer.businessName
                ? `Billed to ${order.customer.businessName}`
                : "Billed to your account details"}
              {order.customer.gstin && ` · GSTIN ${order.customer.gstin}`}
            </p>
            {invoiceReady ? (
              <a
                href={`/api/orders/${order.orderNumber}/invoice`}
                className="button-secondary mt-5 min-h-11"
              >
                <Download size={15} /> Download invoice {order.invoiceNumber}
              </a>
            ) : (
              <p className="mt-5 rounded-xl bg-[var(--canvas-alt)] p-4 text-sm text-[var(--muted)]">
                The tax invoice is generated once payment is confirmed.
              </p>
            )}
          </section>
        </div>

        <section className="surface-card flex flex-wrap gap-3 p-6">
          <a
            href={`https://wa.me/${siteConfig.contact.whatsapp}?text=${encodeURIComponent(`Hello, I need help with order ${order.orderNumber}.`)}`}
            className="button-secondary min-h-11"
            rel="noreferrer noopener"
            target="_blank"
          >
            <MessageCircle size={15} /> Request support
          </a>
          <Link href="/products" className="button-secondary min-h-11">
            <RotateCcw size={15} /> Order again
          </Link>
        </section>
      </div>
    </AccountShell>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-[var(--muted)]" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
