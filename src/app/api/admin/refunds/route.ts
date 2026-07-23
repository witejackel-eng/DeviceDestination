import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveAdmin } from "@/lib/admin-auth";
import { requestRefundAction } from "@/app/admin/actions/orders";

const schema = z.object({
  orderId: z.string().uuid(),
  amountPaise: z.number().int().min(1).max(9_900_000_000),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: NextRequest) {
  const admin = await resolveAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.reason }, { status: admin.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid refund request." }, { status: 400 });
  }
  const result = await requestRefundAction({
    orderId: parsed.data.orderId,
    amountPaise: parsed.data.amountPaise,
    reason: parsed.data.reason,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
