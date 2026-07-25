import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminCard, AdminPage, AdminStatus, AdminTableScroll } from "@/components/admin-section";
import { AdminOrderStatusForm } from "@/components/admin-order-status-form";
import { getAdminOrder } from "@/data/admin-repository";
import { can, requireCapability } from "@/lib/authz";
import { extractIncludedGst, formatPrice } from "@/lib/products";

export const metadata: Metadata = { title: "Order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const user = await requireCapability("orders.view", "/admin/orders");
  const { orderNumber } = await params;
  const record = await getAdminOrder(orderNumber);
  if (!record) notFound();

  const { order, customer, address, payment, items } = record;

  return (
    <AdminPage
      title={order.orderNumber}
      description={`Placed ${order.createdAt.toLocaleString("en-IN")}`}
      back={{ href: "/admin/orders", label: "Orders" }}
    >
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="grid gap-5">
          <AdminCard title="Items">
            <AdminTableScroll>
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.05em] text-[var(--muted)]">
                  <th className="px-4 py-2.5 font-bold">Model</th>
                  <th className="px-4 py-2.5 font-bold">Product</th>
                  <th className="px-4 py-2.5 text-right font-bold">Unit</th>
                  <th className="px-4 py-2.5 text-right font-bold">Qty</th>
                  <th className="px-4 py-2.5 text-right font-bold">GST</th>
                  <th className="px-4 py-2.5 text-right font-bold">Line total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const lineTotal = item.unitPriceInclGstPaise * item.quantity;
                  return (
                    <tr key={item.id} className="border-b border-[var(--line)]">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {item.model}
                      </td>
                      <td className="px-4 py-3">{item.title}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {formatPrice(item.unitPriceInclGstPaise)}
                      </td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-[var(--muted)]">
                        {formatPrice(extractIncludedGst(lineTotal, item.gstRateBasisPoints))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                        {formatPrice(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTableScroll>
            <dl className="grid gap-2 border-t border-[var(--line)] p-5 text-sm">
              <Row label="Subtotal" value={formatPrice(order.subtotalInclGstPaise)} />
              <Row label="Delivery" value={formatPrice(order.shippingPaise)} />
              <Row
                label="Installation"
                value={order.installationRequested ? "Requested — quote separately" : "Not included"}
              />
              <div className="flex justify-between border-t border-[var(--line)] pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatPrice(order.totalInclGstPaise)}</dd>
              </div>
              <Row label="Included GST" value={formatPrice(order.includedGstPaise)} muted />
            </dl>
          </AdminCard>

          <AdminCard title="Payment record">
            <dl className="grid gap-2 p-5 text-sm">
              <Row label="Provider" value={payment?.provider ?? "—"} />
              <Row label="Provider order ID" value={payment?.providerOrderId ?? "—"} />
              <Row
                label="Provider payment ID"
                value={payment?.providerPaymentId ?? "Not captured yet"}
              />
              <Row
                label="Amount"
                value={payment ? formatPrice(payment.amountPaise) : "—"}
              />
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Payment status</dt>
                <dd>
                  <AdminStatus status={payment?.status ?? "pending"} />
                </dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard title="Notifications">
            <dl className="grid gap-2 p-5 text-sm">
              <Row label="Email" value={order.emailStatus} />
              <Row label="WhatsApp" value={order.whatsappStatus} />
              <Row
                label="Invoice"
                value={
                  order.invoiceNumber
                    ? `${order.invoiceNumber} · ${order.invoiceGeneratedAt?.toLocaleDateString("en-IN") ?? "generated"}`
                    : "Not generated"
                }
              />
            </dl>
          </AdminCard>
        </div>

        <div className="grid gap-5">
          <AdminCard title="Fulfilment">
            <div className="p-5">
              <p className="mb-4 flex items-center gap-2 text-sm">
                Current: <AdminStatus status={order.status} />
              </p>
              <AdminOrderStatusForm
                orderNumber={order.orderNumber}
                current={order.status}
                canManage={can(user.role, "orders.manage")}
              />
            </div>
          </AdminCard>

          <AdminCard title="Customer">
            <div className="grid gap-1 p-5 text-sm">
              <p className="font-semibold">{customer.name}</p>
              <p className="text-[var(--muted)]">{customer.email}</p>
              <p className="text-[var(--muted)]">{customer.mobile}</p>
              {customer.businessName && <p className="mt-2">{customer.businessName}</p>}
              {customer.gstin && <p className="font-mono text-xs">GSTIN {customer.gstin}</p>}
              <p className="mt-2 text-xs text-[var(--muted)]">
                {customer.userId ? "Signed-in account" : "No linked account"}
              </p>
            </div>
          </AdminCard>

          <AdminCard title="Delivery address">
            <div className="p-5 text-sm">
              {address ? (
                <address className="not-italic leading-6">
                  {address.line1}
                  {address.line2 && (
                    <>
                      <br />
                      {address.line2}
                    </>
                  )}
                  <br />
                  {address.city}, {address.state} {address.pincode}
                  {address.instructions && (
                    <>
                      <br />
                      <span className="text-[var(--muted)]">{address.instructions}</span>
                    </>
                  )}
                </address>
              ) : (
                <p className="text-[var(--muted)]">No address recorded.</p>
              )}
            </div>
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${muted ? "text-[var(--muted)]" : ""}`}>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="break-all text-right">{value}</dd>
    </div>
  );
}
