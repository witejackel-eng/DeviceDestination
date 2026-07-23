import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { orderRequestSchema } from "@/lib/validation";
import { orchestrateCheckout } from "@/lib/checkout-orchestrator";

/**
 * POST /api/orders — Create a new checkout order.
 *
 * The API route validates the request and delegates all business logic
 * to the checkout orchestrator, which manages the full lifecycle via
 * checkoutAttempts for idempotency tracking.
 */
export async function POST(request: NextRequest) {
  // ── Rate limit check ───────────────────────────────────────────────────────
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const limit = await checkRateLimit(`checkout:${ip}`);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please wait and try again." },
      { status: 429 },
    );
  }

  // ── Parse and validate request ─────────────────────────────────────────────
  const parsed = orderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please review the checkout details.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // ── Honeypot check ─────────────────────────────────────────────────────────
  if (parsed.data.customer.website) {
    return NextResponse.json({ error: "Unable to process request." }, { status: 400 });
  }

  // ── Idempotency key validation ─────────────────────────────────────────────
  const idempotencyKey = request.headers.get("idempotency-key") ?? "";
  if (!/^[a-zA-Z0-9:_-]{16,120}$/.test(idempotencyKey)) {
    return NextResponse.json({ error: "Invalid checkout session. Please retry." }, { status: 400 });
  }

  // ── Delegate to checkout orchestrator ──────────────────────────────────────
  const result = await orchestrateCheckout({
    idempotencyKey,
    customer: parsed.data.customer,
    items: parsed.data.items,
    website: parsed.data.customer.website,
  });

  // ── Map orchestrator result to HTTP response ───────────────────────────────
  switch (result.status) {
    case "ready_for_checkout":
      return NextResponse.json({
        mode: "razorpay",
        keyId: result.keyId,
        orderNumber: result.orderNumber,
        razorpayOrderId: result.razorpayOrderId,
        amount: result.amountPaise,
        totals: result.totals,
        shipping: result.shipping,
      });

    case "duplicate_completed":
      return NextResponse.json({
        mode: "razorpay",
        keyId: result.keyId,
        orderNumber: result.orderNumber,
        razorpayOrderId: result.razorpayOrderId,
        amount: result.amountPaise,
      });

    case "processing":
      return NextResponse.json(
        { error: result.message },
        { status: 409 },
      );

    case "test_mode":
      return NextResponse.json({
        mode: "test",
        verified: true,
        orderNumber: result.orderNumber,
        confirmationToken: result.confirmationToken,
        totals: result.totals,
        message: result.message,
      });

    case "failed":
      const statusCode = result.retryable ? 502 : 400;
      return NextResponse.json({ error: result.error }, { status: statusCode });
  }
}
