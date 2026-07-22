import { Resend } from "resend";

let resend: Resend | null = null;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export async function sendAuthEmail(input: { to: string; subject: string; text: string }) {
  const client = getResend();
  if (!client || !process.env.EMAIL_FROM) throw new Error("Authentication email is not configured");
  await client.emails.send({
    from: process.env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}

export async function sendEnquiryNotifications(input: {
  reference: string;
  type: string;
  name: string;
  email: string;
  mobile: string;
  message: string;
}) {
  const results: string[] = [];
  const client = getResend();
  if (client && process.env.EMAIL_FROM && process.env.SALES_EMAIL) {
    await client.emails.send({
      from: process.env.EMAIL_FROM,
      to: process.env.SALES_EMAIL,
      replyTo: input.email,
      subject: `${input.type} enquiry ${input.reference} — ${input.name}`,
      text: `Reference: ${input.reference}\nName: ${input.name}\nEmail: ${input.email}\nMobile: ${input.mobile}\n\n${input.message}`,
    });
    results.push("email");
  }
  if (
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_TEMPLATE_NAME &&
    process.env.SALES_WHATSAPP_NUMBER
  ) {
    const version = process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0";
    const response = await fetch(
      `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: process.env.SALES_WHATSAPP_NUMBER,
          type: "template",
          template: {
            name: process.env.WHATSAPP_TEMPLATE_NAME,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: input.reference },
                  { type: "text", text: input.name },
                  { type: "text", text: input.mobile },
                  { type: "text", text: input.message.slice(0, 500) },
                ],
              },
            ],
          },
        }),
      },
    );
    if (!response.ok) throw new Error("WhatsApp notification failed");
    results.push("whatsapp");
  }
  return results;
}
