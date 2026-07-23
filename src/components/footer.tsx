import Link from "next/link";
import { DDMark } from "@/components/dd-mark";
import { CookieSettingsLink } from "@/components/cookie-settings-link";
import { siteConfig } from "@/config/site";
import { IndianRupee, BadgeCheck, CreditCard, ShieldCheck } from "lucide-react";

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
      {/* ── Large brand statement ──────────────────────────── */}
      <div className="container-standard pt-16 sm:pt-20 pb-10">
        <div className="flex items-center gap-5 mb-10">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[20px] bg-[var(--tangerine)] sm:h-24 sm:w-24">
            <DDMark tone="dark" className="h-[60%] w-[60%] text-[var(--ink)]" />
          </div>
          <div>
            <p className="font-display text-5xl font-extrabold leading-[0.88] tracking-[-0.02em] sm:text-7xl lg:text-8xl">
              Device
              <br />
              Destination
            </p>
            <p className="mt-3 text-sm text-white/50 max-w-md">
              Security hardware, selected with care. Exact models, clear pricing, real documentation.
            </p>
          </div>
        </div>

        {/* ── Trust badges inline ───────────────────────────── */}
        <div className="flex flex-wrap gap-4 mb-10 border-t border-[var(--line-on-dark)] pt-8">
          {[
            [IndianRupee, "GST-inclusive pricing"],
            [BadgeCheck, "OEM warranty"],
            [CreditCard, "Secure Razorpay checkout"],
            [ShieldCheck, "Exact-model documents"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof BadgeCheck;
            return (
              <div key={label as string} className="flex items-center gap-2 rounded-full bg-white/8 px-4 py-2.5 text-xs font-bold text-white/70">
                <I size={14} className="text-[var(--tangerine)]" />
                {label as string}
              </div>
            );
          })}
          <span className="flex items-center gap-2 rounded-full bg-white/8 px-4 py-2.5 text-xs font-bold text-white/70">
            {siteConfig.serviceArea} support
          </span>
        </div>
      </div>

      {/* ── Link groups ─────────────────────────────────────── */}
      <div className="container-standard">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 pb-10">
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
