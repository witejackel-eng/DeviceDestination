import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveAdmin } from "@/lib/admin-auth";
import { reconcileOrderPayment } from "@/lib/reconciliation";

const schema = z.object({
  orderId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const admin = await resolveAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.reason }, { status: admin.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const result = await reconcileOrderPayment(parsed.data.orderId, admin.context.userId);
  return NextResponse.json(result);
}
