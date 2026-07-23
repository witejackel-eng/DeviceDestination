import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { getAuth, isAuthConfigured } from "@/lib/auth";
import { updateUserProfile, requestAccountAction } from "@/lib/account";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/)
    .nullable()
    .optional(),
});

export async function PATCH(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile data." }, { status: 400 });
  }
  try {
    await updateUserProfile({
      userId: session.user.id,
      name: parsed.data.name,
      mobile: parsed.data.mobile,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const actionSchema = z.object({
  action: z.enum(["export", "deletion"]),
});

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  try {
    await requestAccountAction({ userId: session.user.id, action: parsed.data.action });
    return NextResponse.json({
      ok: true,
      message:
        parsed.data.action === "export"
          ? "Your data export request has been recorded. Our team will contact you."
          : "Your account deletion request has been recorded. Our team will contact you to confirm.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
