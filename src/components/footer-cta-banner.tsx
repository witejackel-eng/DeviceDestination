import { MessageCircle, Phone } from "lucide-react";
import { siteConfig } from "@/config/site";

export function FooterCtaBanner() {
  return (
    <div className="flex flex-col items-start justify-between gap-5 rounded-[24px] border border-[var(--line-on-dark)] p-6 sm:flex-row sm:items-center sm:p-8" style={{ background: "var(--coral)" }}>
      <p className="font-display text-xl font-bold sm:text-2xl text-white">
        Need the right model? Let&apos;s find it.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <a
          href={`https://wa.me/${siteConfig.contact.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)] transition-transform hover:-translate-y-px"
        >
          WhatsApp help <MessageCircle size={15} />
        </a>
        <a
          href={`tel:${siteConfig.contact.phoneE164}`}
          className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/20"
        >
          Call support <Phone size={15} />
        </a>
      </div>
    </div>
  );
}
