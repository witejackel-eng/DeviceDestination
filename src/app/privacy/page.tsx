import type { Metadata } from "next";
import { EditorialPage } from "@/components/editorial-page";
export const metadata: Metadata = { title: "Privacy policy" };
export default function PrivacyPage() {
  return (
    <EditorialPage
      eyebrow="Policy"
      title="Privacy policy"
      intro="How DeviceDestination uses information submitted through checkout, account and enquiry workflows."
      sections={[
        {
          title: "Information collected",
          body: (
            <p>
              We collect contact, delivery, invoice and order details that you submit. Payment card
              data is handled by Razorpay and is not stored by this application.
            </p>
          ),
        },
        {
          title: "How it is used",
          body: (
            <p>
              Details are used to fulfil orders, answer enquiries, provide requested installation
              coordination, prevent abuse and meet legal or tax obligations.
            </p>
          ),
        },
        {
          title: "Service providers",
          body: (
            <p>
              Configured providers may include Neon, Razorpay, Resend, Meta WhatsApp, Upstash and
              Vercel. Each provider processes only the data required for its role.
            </p>
          ),
        },
        {
          title: "Your choices",
          body: (
            <p>
              You may request access, correction or deletion where retention is not legally required
              by emailing manish@insight-solutions.in.
            </p>
          ),
        },
      ]}
    />
  );
}
