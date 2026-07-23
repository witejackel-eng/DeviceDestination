import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { getAuth, isAuthConfigured } from "@/lib/auth";
import {
  claimGuestOrdersForUser,
  createAddressForUser,
} from "@/lib/account";
import { checkRateLimit } from "@/lib/rate-limit";

const addressSchema = z.object({
  line1: z.string().trim().min(8).max(300),
  line2: z.string().trim().max(300).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().regex(/^\d{6}$/),
  instructions: z.string().trim().max(500).optional(),
  isDefault: z.boolean().optional(),
});

async function getSession() {
  if (!isAuthConfigured()) return null;
  return getAuth().api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  // Defer to the account lib to keep authorization logic centralized.
  const { listAddressesForUser } = await import("@/lib/account");
  const addresses = await listAddressesForUser(session.user.id);
  return NextResponse.json({ addresses });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const limit = await checkRateLimit(`address:${ip}`);
  if (!limit.success) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }
  const parsed = addressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid address.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  try {
    const id = await createAddressForUser({
      userId: session.user.id,
      line1: parsed.data.line1,
      line2: parsed.data.line2,
      city: parsed.data.city,
      state: parsed.data.state,
      pincode: parsed.data.pincode,
      instructions: parsed.data.instructions,
      isDefault: parsed.data.isDefault,
    });
    return NextResponse.json({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  // PATCH at /api/account/addresses/[id] handles updates; this route is POST-only.
  return NextResponse.json({ error: "Use PATCH /api/account/addresses/[id]." }, { status: 405 });
}

// POST handler for /api/account/orders/claim — claim guest orders by email.
export async function PUT() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const result = await claimGuestOrdersForUser({
    userId: session.user.id,
    email: session.user.email,
  });
  return NextResponse.json(result);
}
