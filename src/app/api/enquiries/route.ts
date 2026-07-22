import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { enquiries } from "@/db/schema";
import { sendEnquiryNotifications } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { enquirySchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const limit = await checkRateLimit(`enquiry:${ip}`);
  if (!limit.success)
    return NextResponse.json(
      { error: "Too many messages. Please wait before trying again." },
      { status: 429 },
    );
  const parsed = enquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.website)
    return NextResponse.json({ error: "Please review the form fields." }, { status: 400 });
  const reference = `ENQ-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${nanoid(6).toUpperCase()}`;
  let stored = false;
  if (isDatabaseConfigured()) {
    await getDb().insert(enquiries).values({
      referenceNumber: reference,
      type: parsed.data.type,
      name: parsed.data.name,
      email: parsed.data.email,
      mobile: parsed.data.mobile,
      message: parsed.data.message,
    });
    stored = true;
  }
  const notifications = await sendEnquiryNotifications({ reference, ...parsed.data }).catch(
    () => [],
  );
  if (process.env.NODE_ENV === "production" && !stored && notifications.length === 0) {
    return NextResponse.json(
      {
        error:
          "The enquiry service is not active. Call +91 83685 61919 or email manish@insight-solutions.in.",
      },
      { status: 503 },
    );
  }
  return NextResponse.json({
    reference,
    accepted: true,
    mode: stored || notifications.length ? "live" : "local-test",
  });
}
