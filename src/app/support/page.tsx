import type { Metadata } from "next";
import Link from "next/link";
import { FileText, LifeBuoy, PackageCheck, Wrench } from "lucide-react";
export const metadata: Metadata = {
  title: "Support",
  description: "Product documents, compatibility, order and warranty support.",
};
export default function SupportPage() {
  const cards = [
    [FileText, "Find a document", "Exact-model datasheets and manuals.", "/downloads"],
    [PackageCheck, "Order support", "Use your order or enquiry reference.", "/contact"],
    [Wrench, "Installation help", "Request a separate site assessment.", "/quote"],
    [LifeBuoy, "Warranty support", "Understand invoice and OEM conditions.", "/warranty-policy"],
  ];
  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Useful help</p>
      <h1 className="display-section mt-4">Support without a maze.</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
        Start with the exact model number and your invoice or enquiry reference. That is usually
        enough to route the question correctly.
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([Icon, title, copy, href]) => {
          const I = Icon as typeof FileText;
          return (
            <Link key={title as string} href={href as string} className="surface-card p-6">
              <I size={24} />
              <h2 className="mt-10 font-display text-2xl font-semibold">{title as string}</h2>
              <p className="mt-3 leading-7 text-[var(--muted)]">{copy as string}</p>
            </Link>
          );
        })}
      </div>
      <div className="mt-16 rounded-[26px] bg-[var(--tangerine-soft)] p-8 sm:p-12">
        <h2 className="font-display text-4xl font-semibold">Urgent product question?</h2>
        <p className="mt-4 text-lg text-[var(--muted)]">
          Call +91 83685 61919 during business hours or send the model number on WhatsApp.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="tel:+918368561919" className="button-primary">
            Call support
          </a>
          <a
            href="https://wa.me/918368561919"
            target="_blank"
            rel="noopener noreferrer"
            className="button-secondary"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
