import Link from "next/link";
import { Brand } from "@/components/brand";
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
      ["Account", "/account"],
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--canvas-alt)]">
      <div className="container-standard py-12 sm:py-14">
        <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-9 sm:flex-row sm:items-center sm:justify-between">
          <Brand />
          <p className="max-w-lg text-sm text-[var(--muted)] sm:text-right">
            Exact-model security hardware with clear pricing and documentation.
          </p>
        </div>
        <div className="mt-9 grid grid-cols-2 gap-9 sm:grid-cols-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="eyebrow mb-5">{group.title}</p>
              <ul className="grid gap-3 text-sm">
                {group.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-[var(--muted)] hover:text-[var(--ink)]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p className="eyebrow mb-5">Contact</p>
            <address className="grid gap-3 text-sm not-italic text-[var(--muted)]">
              <span>
                {siteConfig.address.street}, {siteConfig.address.city}{" "}
                {siteConfig.address.postalCode}
              </span>
              <a href={`tel:${siteConfig.contact.phoneE164}`} className="hover:text-[var(--ink)]">
                {siteConfig.contact.phoneDisplay}
              </a>
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="break-all hover:text-[var(--ink)]"
              >
                {siteConfig.contact.email}
              </a>
              <a
                href={`https://wa.me/${siteConfig.contact.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[var(--tangerine-text)] hover:text-[var(--ink)]"
              >
                WhatsApp product help
              </a>
            </address>
          </div>
        </div>
      </div>
      <div className="container-standard flex flex-col gap-2 border-t border-[var(--line)] py-5 text-xs text-[var(--muted)] sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} DeviceDestination. All rights reserved.</p>
        <p>Installation is quoted separately through qualified third-party installers.</p>
      </div>
    </footer>
  );
}
