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

      {/* ── Bottom row: copyright, GST identity, quick links ── */}
      <div className="container-standard flex flex-col gap-2 border-t border-white/10 py-5 text-xs text-[var(--dark-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} {siteConfig.legalName}. All rights reserved.{siteConfig.gstin ? ` · GSTIN: ${siteConfig.gstin}` : ""}</p>
        <div className="flex gap-3">
          <CookieSettingsLink className="underline hover:text-[var(--dark-text)] transition-colors" />
          <Link href="/privacy" className="underline hover:text-[var(--dark-text)] transition-colors">Privacy</Link>
          <Link href="/terms" className="underline hover:text-[var(--dark-text)] transition-colors">Terms</Link>
        </div>
      </div>

      {/* ── Legal and assurance panel ───────────────────────── */}
      <div className="border-t border-white/10">
        <div className="container-standard py-[30px] sm:py-[42px] lg:py-[48px]">
          {/* Assurance line */}
          <p className="text-center text-[13px] sm:text-[14px] font-semibold tracking-[0.06em] sm:tracking-[0.12em] uppercase text-[#A8C4E0] max-w-[820px] mx-auto">
            <span aria-hidden="true" className="inline-block mr-1.5 text-[var(--accent)] opacity-70">✦</span>
            SAFE SHOPPING · OEM WARRANTY · GENUINE PRODUCTS · SECURE PAYMENTS
          </p>

          {/* Legal paragraph */}
          <p className="mx-auto mt-5 max-w-[820px] text-center text-[13px] sm:text-[14px] leading-[1.65] text-[var(--dark-muted)]">
            All products are sold with OEM warranty only. Installation and service are provided through independent third-party partners at the customer&apos;s discretion. By using this website, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-[var(--dark-text)] transition-colors focus-visible:outline-[3px] focus-visible:outline-[var(--accent-focus)] focus-visible:outline-offset-[3px]">
              Terms &amp; Conditions
            </Link>,{" "}
            <Link href="/refund-policy" className="underline hover:text-[var(--dark-text)] transition-colors focus-visible:outline-[3px] focus-visible:outline-[var(--accent-focus)] focus-visible:outline-offset-[3px]">
              Return/Refund Policy
            </Link>, and{" "}
            <Link href="/privacy" className="underline hover:text-[var(--dark-text)] transition-colors focus-visible:outline-[3px] focus-visible:outline-[var(--accent-focus)] focus-visible:outline-offset-[3px]">
              Privacy Policy
            </Link>. All disputes are subject to the jurisdiction of New Delhi, India.
          </p>

          {/* Powered-by line */}
          <p className="mt-5 text-center text-[12px] sm:text-[13px] italic text-[var(--dark-muted)] opacity-60">
            <Link href="/" className="hover:text-[var(--dark-text)] transition-colors focus-visible:outline-[3px] focus-visible:outline-[var(--accent-focus)] focus-visible:outline-offset-[3px]">
              DeviceDestination.com
            </Link>{" "}— Powered by Insight Business Solution
          </p>
        </div>
      </div>
    </footer>
  );
}
