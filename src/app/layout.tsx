import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { CompareTray } from "@/components/compare-tray";
import { ConsentGatedAnalytics } from "@/components/consent-gated-analytics";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { CookiePreferencesModal } from "@/components/cookie-preferences-modal";
import { siteConfig } from "@/config/site";
import { isAuthConfigured } from "@/lib/auth";
import "./globals.css";

/**
 * One text family, one technical family.
 *
 * Plus Jakarta Sans carries headings, display type, navigation, buttons and body
 * copy. Geist Mono is reserved for values a customer has to read character by
 * character — model numbers, SKUs, order references — where the body face makes
 * `1`/`l` and `0`/`O` ambiguous. Both are loaded through `next/font/google`, which
 * self-hosts them at build time; no font file is taken from any reference site.
 */
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  display: "swap",
});

const siteUrl = siteConfig.url;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DeviceDestination — Shop exact-model security hardware",
    template: "%s | DeviceDestination",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  openGraph: {
    title: "DeviceDestination",
    description: "Security hardware, selected with care.",
    url: siteUrl,
    siteName: "DeviceDestination",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DeviceDestination",
    description: "Security hardware, selected with care.",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF8A00",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteUrl,
    email: siteConfig.contact.email,
    telephone: siteConfig.contact.phoneE164,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address.street,
      addressLocality: siteConfig.address.city,
      addressRegion: siteConfig.address.region,
      postalCode: siteConfig.address.postalCode,
      addressCountry: siteConfig.address.country,
    },
  };

  return (
    <html lang="en-IN" className={`${plusJakartaSans.variable} ${geistMono.variable}`}>
      <body>
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-[var(--ink)] px-4 py-3 text-white focus:translate-y-0"
        >
          Skip to content
        </a>
        <Header authConfigured={isAuthConfigured()} />
        <main id="main-content">{children}</main>
        <Footer />
        <CartDrawer />
        <CompareTray />
        <CookieConsentBanner />
        <CookiePreferencesModal />
        {process.env.VERCEL && <ConsentGatedAnalytics />}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
        />
      </body>
    </html>
  );
}
