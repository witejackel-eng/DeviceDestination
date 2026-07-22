import { MessageCircle, Phone } from "lucide-react";
import { siteConfig } from "@/config/site";

export function FooterCtaBanner() {
  return (
    <div className="flex flex-col items-start justify-between gap-5 rounded-[28px] bg-[var(--ink)] p-6 text-white sm:flex-row sm:items-center sm:p-8">
      <p className="font-display text-2xl font-bold sm:text-3xl">
        Need the right model? Let&apos;s find it.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <a
          href={`https://wa.me/${siteConfig.contact.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="button-primary"
        >
          WhatsApp help <MessageCircle size={17} />
        </a>
        <a
          href={`tel:${siteConfig.contact.phoneE164}`}
          className="button-secondary !border-white/20 !bg-white/10 !text-white"
        >
          Call support <Phone size={17} />
        </a>
      </div>
    </div>
  );
}
