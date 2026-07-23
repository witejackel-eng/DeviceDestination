import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuth, isAuthConfigured } from "@/lib/auth";
import { claimGuestOrdersForUser } from "@/lib/account";

export async function POST() {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const result = await claimGuestOrdersForUser({
    userId: session.user.id,
    email: session.user.email,
  });
  return NextResponse.json(result);
}
