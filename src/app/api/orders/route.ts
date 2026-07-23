import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { catalogue } from "@/data/catalog";
import { getDb } from "@/db/client";
import {
  addresses,
  customers,
  inventoryReservations,
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
import { getShippingQuote } from "@/lib/shipping";
import { reserveInventoryForOrder, releaseReservationsForOrder } from "@/lib/inventory";
import { enqueueJob } from "@/lib/jobs";
import { isDatabaseConfigured } from "@/db/client";

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

  // Server-side shipping validation. Block checkout for explicitly unserviceable
  // pincodes. Manual-confirmation pincodes still proceed (the order record
  // carries the serviceability result so operations can confirm before dispatch).
  const shippingQuote = await getShippingQuote({
    pincode: parsed.data.customer.pincode,
    subtotalInclGstPaise,
    products: trustedLines.map((line) => ({
      model: line.product.model,
      quantity: line.quantity,
    })),
  });
  if (shippingQuote.serviceability === "unserviceable") {
    return NextResponse.json(
      { error: shippingQuote.message },
      { status: 400 },
    );
  }
  const shippingPaise = shippingQuote.shippingPaise;
  const grandTotalInclGstPaise = subtotalInclGstPaise + shippingPaise;

  const totals = {
    subtotalInclGstPaise,
    shippingPaise,
    installationPaise: null,
    includedGstPaise,
    grandTotalInclGstPaise,
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
      shippingPaise,
      totalInclGstPaise: grandTotalInclGstPaise,
      includedGstPaise,
      installationRequested: customer.installationRequested,
      idempotencyKey,
      serviceabilityResult: shippingQuote as unknown as Record<string, unknown>,
      estimatedDeliveryAt: shippingQuote.estimatedDaysMax
        ? new Date(Date.now() + shippingQuote.estimatedDaysMax * 86_400_000)
        : null,
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

  // Inventory reservation: atomic, with compensation on failure.
  try {
    await reserveInventoryForOrder({
      orderId: savedOrder.id,
      items: trustedLines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.error(
      { event: "inventory_reservation_failed", orderNumber, error: message },
      "Inventory reservation failed during checkout",
    );
    // Best-effort cleanup of the partial order record. Reservations that did
    // succeed have already been released by reserveInventoryForOrder.
    try {
      await db.delete(orderItems).where(eq(orderItems.orderId, savedOrder.id));
      await db.delete(orders).where(eq(orders.id, savedOrder.id));
    } catch {
      // swallow — the order record remains but has no payment and will be
      // cancelled by the cron expiration sweep.
    }
    return NextResponse.json(
      { error: "Insufficient stock for one or more items. Please adjust your cart." },
      { status: 409 },
    );
  }

  let razorpayOrder: { id: string };
  try {
    razorpayOrder = await getRazorpay().orders.create({
      amount: totals.grandTotalInclGstPaise,
      currency: "INR",
      receipt: orderNumber,
      notes: {
        customerEmail: customer.email,
        installationRequested: String(customer.installationRequested),
      },
    });
  } catch (error) {
    // Compensation: release reservations and cancel the pending order.
    await releaseReservationsForOrder(savedOrder.id, "razorpay_create_failed");
    await db
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, savedOrder.id));
    logger.error(
      {
        event: "razorpay_order_create_failed",
        orderNumber,
        error: error instanceof Error ? error.message : "unknown",
      },
      "Razorpay order creation failed",
    );
    return NextResponse.json(
      { error: "Payment provider is unavailable. Please retry or request a quote." },
      { status: 502 },
    );
  }

  await db.insert(payments).values({
    orderId: savedOrder.id,
    providerOrderId: razorpayOrder.id,
    status: "created",
    amountPaise: totals.grandTotalInclGstPaise,
  });
  logger.info(
    { event: "order_created", orderNumber, providerOrderId: razorpayOrder.id, shippingPaise },
    "Order created with shipping and inventory reservation",
  );
  return NextResponse.json({
    mode: "razorpay",
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID,
    orderNumber,
    razorpayOrderId: razorpayOrder.id,
    amount: totals.grandTotalInclGstPaise,
    totals,
    shipping: shippingQuote,
  });
}
