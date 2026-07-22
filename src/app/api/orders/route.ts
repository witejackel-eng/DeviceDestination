import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { catalogue } from "@/data/catalog";
import { getDb } from "@/db/client";
import {
  addresses,
  customers,
  orderItems,
  orders,
  payments,
  products as productTable,
} from "@/db/schema";
import { createOrderConfirmationToken } from "@/lib/order-token";
import { calculateCartTotals, extractIncludedGst } from "@/lib/products";
import { getPurchaseEligibility } from "@/lib/products";
import { getPriceMaxAgeDays } from "@/config/site";
import { logger } from "@/lib/logger";
import { getRazorpay } from "@/lib/razorpay";
import { checkRateLimit } from "@/lib/rate-limit";
import { orderRequestSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const limit = await checkRateLimit(`checkout:${ip}`);
  if (!limit.success)
    return NextResponse.json(
      { error: "Too many checkout attempts. Please wait and try again." },
      { status: 429 },
    );
  const parsed = orderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Please review the checkout details.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  if (parsed.data.customer.website)
    return NextResponse.json({ error: "Unable to process request." }, { status: 400 });

  const previewLines = parsed.data.items.flatMap((line) => {
    const product = catalogue.find((item) => item.id === line.productId);
    return product ? [{ product, quantity: line.quantity }] : [];
  });
  if (
    previewLines.length !== parsed.data.items.length ||
    previewLines.some(
      (line) =>
        !getPurchaseEligibility(line.product, { maxAgeDays: getPriceMaxAgeDays() }).eligible,
    )
  ) {
    return NextResponse.json(
      { error: "One or more products changed. Refresh the cart and try again." },
      { status: 409 },
    );
  }
  const previewTotals = calculateCartTotals(previewLines);
  const orderNumber = `DD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${nanoid(6).toUpperCase()}`;
  logger.info(
    { event: "order_creation_started", orderNumber, itemCount: previewLines.length },
    "Order creation started",
  );

  if (
    process.env.NODE_ENV !== "production" &&
    (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
  ) {
    return NextResponse.json({
      mode: "test",
      verified: true,
      orderNumber,
      confirmationToken: createOrderConfirmationToken(orderNumber),
      totals: previewTotals,
      message: "Server-confirmed local test order; no payment was captured.",
    });
  }
  if (
    !process.env.DATABASE_URL ||
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET
  ) {
    return NextResponse.json(
      { error: "Online payments are not active yet. Please request a quote instead." },
      { status: 503 },
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key") ?? "";
  if (!/^[a-zA-Z0-9:_-]{16,120}$/.test(idempotencyKey))
    return NextResponse.json({ error: "Invalid checkout session. Please retry." }, { status: 400 });

  const db = getDb();
  const existing = await db
    .select({
      orderNumber: orders.orderNumber,
      providerOrderId: payments.providerOrderId,
      amount: payments.amountPaise,
    })
    .from(orders)
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(eq(orders.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing[0]?.providerOrderId) {
    return NextResponse.json({
      mode: "razorpay",
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID,
      orderNumber: existing[0].orderNumber,
      razorpayOrderId: existing[0].providerOrderId,
      amount: existing[0].amount,
    });
  }
  if (existing.length)
    return NextResponse.json(
      {
        error: `Order ${existing[0].orderNumber} is pending setup. Contact support before retrying.`,
      },
      { status: 409 },
    );

  const requestedSlugs = parsed.data.items.map((line) => line.productId);
  const trustedProducts = await db
    .select()
    .from(productTable)
    .where(and(eq(productTable.status, "published"), inArray(productTable.slug, requestedSlugs)));
  const trustedLines = parsed.data.items.flatMap((line) => {
    const product = trustedProducts.find((item) => item.slug === line.productId);
    if (
      !product ||
      product.sellingPriceInclGstPaise === null ||
      product.priceSourceStatus !== "verified" ||
      product.stockStatus === "quote_only" ||
      product.stockStatus === "lead_time" ||
      !product.priceVerifiedAt ||
      Date.now() - product.priceVerifiedAt.getTime() > getPriceMaxAgeDays() * 86_400_000
    )
      return [];
    return [{ product, quantity: line.quantity }];
  });
  if (trustedLines.length !== parsed.data.items.length)
    return NextResponse.json(
      { error: "Catalogue prices changed. Refresh the cart before paying." },
      { status: 409 },
    );

  const subtotalInclGstPaise = trustedLines.reduce(
    (sum, line) => sum + line.product.sellingPriceInclGstPaise! * line.quantity,
    0,
  );
  const includedGstPaise = trustedLines.reduce(
    (sum, line) =>
      sum +
      extractIncludedGst(
        line.product.sellingPriceInclGstPaise! * line.quantity,
        line.product.gstRateBasisPoints,
      ),
    0,
  );
  const totals = {
    subtotalInclGstPaise,
    shippingPaise: 0,
    installationPaise: null,
    includedGstPaise,
    grandTotalInclGstPaise: subtotalInclGstPaise,
  };

  const customer = parsed.data.customer;
  const [savedCustomer] = await db
    .insert(customers)
    .values({
      name: customer.name,
      email: customer.email,
      mobile: customer.mobile,
      gstin: customer.gstin || null,
      businessName: customer.businessName || null,
    })
    .returning({ id: customers.id });
  const [savedAddress] = await db
    .insert(addresses)
    .values({
      customerId: savedCustomer.id,
      line1: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
      instructions: customer.instructions || null,
    })
    .returning({ id: addresses.id });
  const [savedOrder] = await db
    .insert(orders)
    .values({
      orderNumber,
      customerId: savedCustomer.id,
      shippingAddressId: savedAddress.id,
      status: "payment_pending",
      subtotalInclGstPaise,
      shippingPaise: 0,
      totalInclGstPaise: subtotalInclGstPaise,
      includedGstPaise,
      installationRequested: customer.installationRequested,
      idempotencyKey,
    })
    .returning({ id: orders.id });
  await db.insert(orderItems).values(
    trustedLines.map(({ product, quantity }) => ({
      orderId: savedOrder.id,
      productId: product.id,
      model: product.model,
      title: product.title,
      quantity,
      unitPriceInclGstPaise: product.sellingPriceInclGstPaise!,
      gstRateBasisPoints: product.gstRateBasisPoints,
    })),
  );

  const razorpayOrder = await getRazorpay().orders.create({
    amount: totals.grandTotalInclGstPaise,
    currency: "INR",
    receipt: orderNumber,
    notes: {
      customerEmail: customer.email,
      installationRequested: String(customer.installationRequested),
    },
  });
  await db.insert(payments).values({
    orderId: savedOrder.id,
    providerOrderId: razorpayOrder.id,
    status: "created",
    amountPaise: totals.grandTotalInclGstPaise,
  });
  logger.info(
    { event: "order_created", orderNumber, providerOrderId: razorpayOrder.id },
    "Order created",
  );
  return NextResponse.json({
    mode: "razorpay",
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID,
    orderNumber,
    razorpayOrderId: razorpayOrder.id,
    amount: totals.grandTotalInclGstPaise,
    totals,
  });
}
