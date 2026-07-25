import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { addresses, customers, orderItems, orders } from "@/db/schema";
import { createInvoicePdf } from "@/lib/invoice";
import { verifyOrderConfirmationToken } from "@/lib/order-token";
import { getSessionUser } from "@/lib/authz";

type Params = Promise<{ orderNumber: string }>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const { orderNumber } = await params;
  const token = request.nextUrl.searchParams.get("token") ?? "";

  // Two independent ways to prove entitlement: the signed confirmation token
  // emailed at checkout, or a session that owns the order. Ownership is checked
  // against the database below, never asserted by the request.
  const tokenValid = verifyOrderConfirmationToken(orderNumber, token);
  const sessionUser = tokenValid ? null : await getSessionUser();
  if (!tokenValid && !sessionUser)
    return NextResponse.json({ error: "Invalid invoice link." }, { status: 401 });

  if (!isDatabaseConfigured())
    return NextResponse.json({ error: "Invoice storage is unavailable." }, { status: 503 });
  const db = getDb();
  const result = await db
    .select({ order: orders, customer: customers, address: addresses })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .innerJoin(addresses, eq(addresses.id, orders.shippingAddressId))
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  const record = result[0];
  if (!tokenValid && record && record.customer.userId !== sessionUser?.id)
    return NextResponse.json({ error: "Invoice is not available." }, { status: 404 });
  if (!record || record.order.status !== "paid" || !record.order.invoiceNumber)
    return NextResponse.json({ error: "Invoice is not ready yet." }, { status: 404 });
  const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, record.order.id));
  const pdf = await createInvoicePdf({
    invoiceNumber: record.order.invoiceNumber,
    orderNumber,
    issuedAt: record.order.invoiceGeneratedAt ?? record.order.updatedAt,
    customer: {
      name: record.customer.name,
      businessName: record.customer.businessName,
      gstin: record.customer.gstin,
      address: record.address.line1,
      city: record.address.city,
      state: record.address.state,
      pincode: record.address.pincode,
    },
    items: lines,
    totalInclGstPaise: record.order.totalInclGstPaise,
    includedGstPaise: record.order.includedGstPaise,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${record.order.invoiceNumber}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
