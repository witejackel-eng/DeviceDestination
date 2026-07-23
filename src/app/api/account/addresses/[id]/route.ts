import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { getAuth, isAuthConfigured } from "@/lib/auth";
import { deleteAddressForUser, updateAddressForUser } from "@/lib/account";

const updateSchema = z.object({
  line1: z.string().trim().min(8).max(300).optional(),
  line2: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().min(2).max(80).optional(),
  state: z.string().trim().min(2).max(80).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  instructions: z.string().trim().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
});

type Params = { id: string };

async function getSession() {
  if (!isAuthConfigured()) return null;
  return getAuth().api.getSession({ headers: await headers() });
}

export async function PATCH(request: NextRequest, context: { params: Promise<Params> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid address." }, { status: 400 });
  }
  try {
    await updateAddressForUser({ userId: session.user.id, addressId: id, ...parsed.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = message.includes("not_found") ? 404 : message.includes("in_use") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<Params> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  try {
    await deleteAddressForUser({ userId: session.user.id, addressId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = message.includes("not_found") ? 404 : message.includes("in_use") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
