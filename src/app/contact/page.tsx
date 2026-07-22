import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { EnquiryForm } from "@/components/enquiry-form";
import { publicPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Contact",
  description: "Speak with DeviceDestination about exact security and biometric product models.",
  path: "/contact",
});
export default function ContactPage() {
  return (
    <div className="container-standard section-space !pt-14">
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="eyebrow">Product help</p>
          <h1 className="display-section mt-4">Talk to a person who checks the model.</h1>
        </div>
        <p className="max-w-2xl self-end text-lg leading-8 text-[var(--muted)]">
          Send the model number, quantity and site type if you know them. If you do not, describe
          the space in plain language.
        </p>
      </div>
      <div className="mt-12 grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="grid content-start gap-4">
          <a
            href={`tel:${siteConfig.contact.phoneE164}`}
            className="surface-card flex min-h-24 items-center gap-4 p-5"
          >
            <Phone />
            <span>
              <strong>Call</strong>
              <br />
              <span className="text-sm text-[var(--muted)]">{siteConfig.contact.phoneDisplay}</span>
            </span>
          </a>
          <a
            href={`mailto:${siteConfig.contact.email}`}
            className="surface-card flex min-h-24 items-center gap-4 p-5"
          >
            <Mail />
            <span>
              <strong>Email</strong>
              <br />
              <span className="text-sm text-[var(--muted)]">{siteConfig.contact.email}</span>
            </span>
          </a>
          <a
            href={`https://wa.me/${siteConfig.contact.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="surface-card flex min-h-24 items-center gap-4 p-5"
          >
            <MessageCircle />
            <span>
              <strong>WhatsApp</strong>
              <br />
              <span className="text-sm text-[var(--muted)]">Product enquiries</span>
            </span>
          </a>
          <div className="surface-card flex min-h-24 items-start gap-4 p-5">
            <MapPin className="mt-1 shrink-0" />
            <span>
              <strong>Dwarka, New Delhi</strong>
              <br />
              <span className="text-sm leading-6 text-[var(--muted)]">
                {siteConfig.address.street}, {siteConfig.address.city}{" "}
                {siteConfig.address.postalCode}
              </span>
            </span>
          </div>
        </aside>
        <EnquiryForm type="contact" title="Send a product enquiry" buttonLabel="Send enquiry" />
      </div>
    </div>
  );
}
