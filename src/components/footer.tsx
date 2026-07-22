import Link from "next/link";
import { Brand } from "@/components/brand";
import { DDMark } from "@/components/dd-mark";
import { FooterCtaBanner } from "@/components/footer-cta-banner";
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
    <footer className="bg-[var(--ink)] text-white">
      <div className="container-standard py-12 sm:py-14">
        <FooterCtaBanner />
        <div className="mt-9 flex flex-col gap-4 border-b border-[var(--line-on-dark)] pb-9 sm:flex-row sm:items-center sm:justify-between">
          <Brand inverted />
          <p className="max-w-lg text-sm text-white/60 sm:text-right">
            Exact-model security hardware with clear pricing and documentation.
          </p>
        </div>
        <div className="mt-9 grid grid-cols-2 gap-9 sm:grid-cols-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="eyebrow mb-5 !text-white/55">{group.title}</p>
              <ul className="grid gap-3 text-sm">
                {group.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-white/70 hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p className="eyebrow mb-5 !text-white/55">Contact</p>
            <address className="grid gap-3 text-sm not-italic text-white/70">
              <span>
                {siteConfig.address.street}, {siteConfig.address.city}{" "}
                {siteConfig.address.postalCode}
              </span>
              <a href={`tel:${siteConfig.contact.phoneE164}`} className="hover:text-white">
                {siteConfig.contact.phoneDisplay}
              </a>
              <a href={`mailto:${siteConfig.contact.email}`} className="break-all hover:text-white">
                {siteConfig.contact.email}
              </a>
              <a
                href={`https://wa.me/${siteConfig.contact.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[var(--tangerine)] hover:text-white"
              >
                WhatsApp product help
              </a>
            </address>
          </div>
        </div>
        <div className="mt-12 flex items-center gap-4 border-t border-[var(--line-on-dark)] pt-10">
          <DDMark tone="dark" className="h-14 w-14 shrink-0 text-[var(--tangerine)] sm:h-20 sm:w-20" />
          <p className="font-display text-4xl font-extrabold leading-[0.85] tracking-[-0.01em] sm:text-6xl">
            Device
            <br />
            Destination
          </p>
        </div>
      </div>
      <div className="container-standard flex flex-col gap-3 border-t border-[var(--line-on-dark)] py-5 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} DeviceDestination. All rights reserved.</p>
        <p>Installation is quoted separately through qualified third-party installers.</p>
        <CookieSettingsLink className="text-left underline hover:text-white sm:text-right" />
      </div>
    </footer>
  );
}
