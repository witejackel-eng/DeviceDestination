import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, CheckCircle2, Users, Lightbulb, MessageCircle, ShoppingBag, CreditCard, Truck, Wrench } from "lucide-react";
import { publicPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = publicPageMetadata({
  title: "About DeviceDestination",
  description: "How DeviceDestination selects and explains security hardware by exact model.",
  path: "/about",
});

const principles = [
  { Icon: ShieldCheck, title: "Integrity", description: "Genuine OEM products with upfront, transparent pricing." },
  { Icon: CheckCircle2, title: "Reliability", description: "Consistent supply, authentic documentation, and dependable warranty support." },
  { Icon: Users, title: "Customer focus", description: "Responsive assistance from enquiry through post-purchase warranty service." },
  { Icon: Lightbulb, title: "Practical innovation", description: "Continuously expanding our catalog with modern security technologies." },
];

const steps = [
  { Icon: MessageCircle, title: "Requirement discussion", description: "Understanding your security requirements, site constraints, and budget before any recommendation." },
  { Icon: ShoppingBag, title: "Product recommendation", description: "Matching genuine OEM products to your specific environment with clear specifications." },
  { Icon: CreditCard, title: "Secure purchase", description: "Simple online ordering with tax-inclusive pricing and instant order confirmation." },
  { Icon: Truck, title: "Delivery coordination", description: "Timely dispatch and delivery coordination across Delhi NCR with status updates." },
  { Icon: ShieldCheck, title: "Warranty support", description: "OEM warranty registration, claims assistance, and continued after-sales coordination." },
  { Icon: Wrench, title: "Installation coordination", description: "Connection with certified third-party professionals for commissioned system setup. Installation is not included in the product price and is quoted separately." },
];

export default function AboutPage() {
  return (
    <div className="container-standard section-space !pt-14">
      {/* Section 1: Who We Are */}
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="eyebrow">About DeviceDestination</p>
          <h1 className="section-title mt-4">Security equipment, explained properly.</h1>
        </div>
        <div className="self-end">
          <p className="max-w-2xl text-lg leading-8 text-[var(--text-secondary)]">
            DeviceDestination is an authorised OEM supplier serving {siteConfig.serviceArea}. We provide genuine CCTV systems, access control, biometric solutions, and networking hardware to homes, offices, shops, and commercial establishments.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted)]">
            We are a primarily online seller focused on transparent pricing, accurate specifications, and genuine OEM warranty support. Every product is sourced through authorised channels, and installation is facilitated through certified third-party installation partners where required.
          </p>
          <Link href="/products" className="button-primary mt-7">
            Browse the catalogue
          </Link>
        </div>
      </div>

      {/* Section 2: Four equal principles */}
      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {principles.map(({ Icon, title, description }) => (
          <div key={title} className="surface-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-btn)] bg-[var(--surface-subtle)]">
              <Icon size={20} className="text-[var(--text-secondary)]" />
            </div>
            <h2 className="mt-8 font-display text-xl font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{description}</p>
          </div>
        ))}
      </div>

      {/* Section 3: How purchasing works */}
      <section className="mt-16">
        <p className="eyebrow">How purchasing works</p>
        <h2 className="section-title mt-3">From discussion to warranty support.</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
          Every purchase follows a clear path. Installation remains a separate specialist service and is never presented as included in a product price.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map(({ Icon, title, description }, index) => (
            <div key={title} className="surface-card p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-btn)] bg-[var(--surface-subtle)]">
                  <Icon size={20} className="text-[var(--text-secondary)]" />
                </div>
                <span className="font-mono text-xs font-medium text-[var(--text-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Support statement */}
      <section className="mt-16">
        <div className="rounded-[var(--radius-container)] bg-[var(--dark)] p-8 text-[var(--dark-text)] sm:p-14">
          <p className="eyebrow !text-[var(--dark-muted)]">What we do — and do not do</p>
          <h2 className="mt-4 max-w-4xl font-display text-3xl sm:text-4xl font-semibold leading-snug">
            We sell hardware and help customers choose it. Installation remains a separate specialist service.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--dark-muted)]">
            Where requested, qualified third-party installers can assess and quote the site.
            DeviceDestination does not present installation as included in a product price.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/products" className="button-primary">Browse products</Link>
            <Link href="/contact" className="button-secondary !border-white/20 !bg-transparent !text-[var(--dark-text)] hover:!bg-white/10">Contact us</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
