import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getShippingQuote } from "@/lib/shipping";

const schema = z.object({
  pincode: z.string().regex(/^\d{6}$/),
  subtotalInclGstPaise: z.number().int().min(0),
  products: z
    .array(
      z.object({
        model: z.string().min(1).max(120),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const quote = await getShippingQuote(parsed.data);
  return NextResponse.json(quote);
}
