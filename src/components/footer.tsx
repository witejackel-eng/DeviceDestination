import Link from "next/link";
import { Brand } from "@/components/brand";
import { DDMark } from "@/components/dd-mark";
import { CookieSettingsLink } from "@/components/cookie-settings-link";
import { siteConfig } from "@/config/site";

const groups = [
  {
    title: "Shop",
    links: [
      ["All products", "/products"],
      ["CCTV cameras", "/products?q=camera"],
      ["NVRs and storage", "/categories/nvr-systems"],
      ["Biometrics", "/categories/biometric-devices"],
      ["Networking", "/categories/poe-switches"],
      ["Compare", "/compare"],
    ],
  },
  {
    title: "Customer help",
    links: [
      ["Contact", "/contact"],
      ["Shipping", "/shipping-policy"],
      ["Returns", "/refund-policy"],
      ["Warranty", "/warranty-policy"],
      ["Installation policy", "/installation-policy"],
      ["Downloads", "/downloads"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Cookie policy", "/cookie-policy"],
      ["Account", "/account"],
    ],
  },
] as const;

export function Footer() {
  return (
    <footer style={{ background: "var(--ink)" }} className="text-white">
      {/* Main footer content */}
      <div className="container-standard py-14 sm:py-16">
        {/* Brand block */}
        <div className="flex flex-col gap-6 border-b border-[var(--line-on-dark)] pb-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <Brand inverted />
          </div>
          <p className="max-w-md text-sm text-white/60 sm:text-right leading-relaxed">
            Exact-model security hardware with clear pricing and documentation.
            Based in {siteConfig.serviceArea}.
          </p>
        </div>

        {/* Link groups */}
        <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="eyebrow mb-4 !text-white/45">{group.title}</p>
              <ul className="grid gap-2.5">
                {group.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-white/65 hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p className="eyebrow mb-4 !text-white/45">Contact</p>
            <address className="grid gap-2.5 text-sm not-italic text-white/65">
              <span>
                {siteConfig.address.street}, {siteConfig.address.city}{" "}
                {siteConfig.address.postalCode}
              </span>
              <a href={`tel:${siteConfig.contact.phoneE164}`} className="hover:text-white transition-colors">
                {siteConfig.contact.phoneDisplay}
              </a>
              <a href={`mailto:${siteConfig.contact.email}`} className="break-all hover:text-white transition-colors">
                {siteConfig.contact.email}
              </a>
              <a
                href={`https://wa.me/${siteConfig.contact.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold hover:text-white transition-colors"
                style={{ color: "var(--tangerine)" }}
              >
                WhatsApp product help
              </a>
            </address>
          </div>
        </div>

        {/* Large wordmark */}
        <div className="mt-14 flex items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--tangerine)] sm:h-20 sm:w-20">
            <DDMark tone="dark" className="h-full w-full text-[var(--ink)]" />
          </div>
          <div>
            <p className="font-display text-5xl font-extrabold leading-[0.88] tracking-[-0.02em] sm:text-7xl">
              Device
              <br />
              Destination
            </p>
            <p className="mt-3 text-sm text-white/50">
              Security hardware, selected with care.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="container-standard flex flex-col gap-2 border-t border-[var(--line-on-dark)] py-4 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} DeviceDestination. All rights reserved.</p>
        <p>Installation is quoted separately through qualified third-party installers.</p>
        <CookieSettingsLink className="text-left underline hover:text-white sm:text-right transition-colors" />
      </div>
    </footer>
  );
}
