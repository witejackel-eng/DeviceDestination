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
          <h1 className="section-title mt-4">Talk to a product specialist.</h1>
        </div>
        <p className="max-w-2xl self-end text-lg leading-8 text-[var(--text-secondary)]">
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
            <Phone size={20} className="text-[var(--text-secondary)]" />
            <span>
              <strong className="text-[var(--text-primary)]">Call</strong>
              <br />
              <span className="text-sm text-[var(--text-muted)]">{siteConfig.contact.phoneDisplay}</span>
            </span>
          </a>
          <a
            href={`mailto:${siteConfig.contact.email}`}
            className="surface-card flex min-h-24 items-center gap-4 p-5"
          >
            <Mail size={20} className="text-[var(--text-secondary)]" />
            <span>
              <strong className="text-[var(--text-primary)]">Email</strong>
              <br />
              <span className="text-sm text-[var(--text-muted)]">{siteConfig.contact.email}</span>
            </span>
          </a>
          <a
            href={`https://wa.me/${siteConfig.contact.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="surface-card flex min-h-24 items-center gap-4 p-5"
          >
            <MessageCircle size={20} className="text-[var(--accent)]" />
            <span>
              <strong className="text-[var(--text-primary)]">WhatsApp</strong>
              <br />
              <span className="text-sm text-[var(--text-muted)]">Product enquiries</span>
            </span>
          </a>
          <div className="surface-card flex min-h-24 items-start gap-4 p-5">
            <MapPin size={20} className="mt-1 shrink-0 text-[var(--text-secondary)]" />
            <span>
              <strong className="text-[var(--text-primary)]">{siteConfig.address.city}</strong>
              <br />
              <span className="text-sm leading-6 text-[var(--text-muted)]">
                {siteConfig.address.street}, {siteConfig.address.city} {siteConfig.address.postalCode}
              </span>
              <br />
              <span className="text-sm text-[var(--text-muted)]">Service area: {siteConfig.serviceArea}</span>
            </span>
          </div>
        </aside>
        <EnquiryForm type="contact" title="Send a product enquiry" buttonLabel="Send enquiry" />
      </div>
    </div>
  );
}
