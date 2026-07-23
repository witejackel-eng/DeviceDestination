import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderDetailForAdmin } from "@/app/admin/actions/orders";
import { OrderDetail } from "@/components/admin/order-detail";
import { formatPrice } from "@/lib/products";

export const metadata: Metadata = { title: "Admin · Order", robots: { index: false, follow: false } };

type Params = Promise<{ id: string }>;

export default async function AdminOrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getOrderDetailForAdmin(id);
  if (!data) notFound();
  const { order, customer, address, items, payments, refunds, reservations, events } = data;
  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin/orders" className="text-sm font-bold underline">
        ← Orders
      </Link>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="display-section mt-2">{order.orderNumber}</h1>
      <p className="mt-4 text-[var(--text-muted)]">
        Status: <strong>{order.status.replaceAll("_", " ")}</strong> · Total:{" "}
        <strong>{formatPrice(order.totalInclGstPaise)}</strong> · Created:{" "}
        {new Date(order.createdAt).toLocaleString()}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <OrderDetail
          order={order}
          items={items}
          payments={payments}
          refunds={refunds}
          reservations={reservations}
          events={events}
        />

        <div className="surface-card p-6">
          <h2 className="font-display text-2xl font-semibold">Customer</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div>
              <dt className="text-[var(--text-muted)]">Name</dt>
              <dd className="mt-1">{customer.name}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Email</dt>
              <dd className="mt-1 font-mono text-xs">{customer.email}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Mobile</dt>
              <dd className="mt-1 font-mono text-xs">{customer.mobile}</dd>
            </div>
            {customer.businessName && (
              <div>
                <dt className="text-[var(--text-muted)]">Business</dt>
                <dd className="mt-1">{customer.businessName}</dd>
              </div>
            )}
            {customer.gstin && (
              <div>
                <dt className="text-[var(--text-muted)]">GSTIN</dt>
                <dd className="mt-1 font-mono text-xs">{customer.gstin}</dd>
              </div>
            )}
          </dl>
          <h3 className="mt-6 font-display text-lg font-semibold">Shipping address</h3>
          <address className="mt-2 text-sm not-italic">
            {address.line1}
            <br />
            {address.city}, {address.state} {address.pincode}
            {address.instructions && (
              <>
                <br />
                <span className="text-[var(--text-muted)]">Instructions: {address.instructions}</span>
              </>
            )}
          </address>
        </div>
      </div>
    </div>
  );
}
