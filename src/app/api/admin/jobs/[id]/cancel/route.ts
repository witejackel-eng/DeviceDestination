import { NextRequest, NextResponse } from "next/server";
import { resolveAdmin } from "@/lib/admin-auth";
import { cancelJob } from "@/lib/jobs";

type Params = { id: string };

export async function POST(_request: NextRequest, context: { params: Promise<Params> }) {
  const admin = await resolveAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.reason }, { status: admin.status });
  }
  const { id } = await context.params;
  await cancelJob(id);
  return NextResponse.json({ ok: true });
}
