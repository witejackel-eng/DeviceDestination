import Link from "next/link";
import { DDMark } from "@/components/dd-mark";
import { CookieSettingsLink } from "@/components/cookie-settings-link";
import { siteConfig } from "@/config/site";

const columns = [
  {
    title: "Shop",
    links: [
      ["All products", "/products"],
      ["CCTV cameras", "/products?q=camera"],
      ["NVR systems", "/categories/nvr-systems"],
      ["Biometric devices", "/categories/biometric-devices"],
      ["Networking", "/categories/poe-switches"],
    ],
  },
  {
    title: "Customer help",
    links: [
      ["Contact", "/contact"],
      ["Support", "/support"],
      ["Shipping", "/shipping-policy"],
      ["Returns", "/refund-policy"],
      ["Warranty", "/warranty-policy"],
      ["Downloads", "/downloads"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Account", "/account"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Cookie preferences", "/cookie-policy"],
    ],
  },
] as const;

export function Footer() {
  return (
    <footer style={{ background: "var(--dark)" }} className="text-[var(--dark-text)]">
      {/* ── Main footer content ──────────────────────────────── */}
      <div className="container-standard pt-14 pb-10 sm:pt-16">
        {/* Column 1: Logo + description + contact */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 mb-10">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-3 min-h-11" aria-label={`${siteConfig.name} home`}>
              <span className="h-10 w-10 shrink-0">
                <DDMark tone="light" className="h-full w-full" />
              </span>
              <span className="font-display font-semibold tracking-[-0.025em] text-lg text-[var(--dark-text)]">
                Device<span className="text-[var(--accent)]">Destination</span>
              </span>
            </Link>
            <p className="mt-4 text-sm text-[var(--dark-muted)] max-w-md leading-6">
              Security hardware, selected with care. Exact models, clear pricing, real documentation.
            </p>
            <address className="mt-5 grid gap-2 text-sm not-italic text-[var(--dark-muted)]">
              <a href={`tel:${siteConfig.contact.phoneE164}`} className="hover:text-[var(--dark-text)] transition-colors">
                {siteConfig.contact.phoneDisplay}
              </a>
              <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-[var(--dark-text)] transition-colors break-all">
                {siteConfig.contact.email}
              </a>
              <a
                href={`https://wa.me/${siteConfig.contact.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold hover:text-[var(--dark-text)] transition-colors"
                style={{ color: "var(--accent)" }}
              >
                WhatsApp product help
              </a>
              <span>
                {siteConfig.address.street}, {siteConfig.address.city} {siteConfig.address.postalCode}
              </span>
            </address>
          </div>

          {/* Columns 2–4: Link groups */}
          {columns.map((column) => (
            <div key={column.title}>
              <p className="eyebrow mb-4 !text-[var(--dark-muted)]">{column.title}</p>
              <ul className="grid gap-2.5">
                {column.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-[var(--dark-muted)] hover:text-[var(--dark-text)] transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="container-standard flex flex-col gap-2 border-t border-white/10 py-5 text-xs text-[var(--dark-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} {siteConfig.legalName}. All rights reserved.</p>
        <p>Installation is quoted separately through qualified third-party installers.</p>
        <div className="flex gap-3">
          <CookieSettingsLink className="underline hover:text-[var(--dark-text)] transition-colors" />
          <Link href="/privacy" className="underline hover:text-[var(--dark-text)] transition-colors">Privacy</Link>
          <Link href="/terms" className="underline hover:text-[var(--dark-text)] transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
