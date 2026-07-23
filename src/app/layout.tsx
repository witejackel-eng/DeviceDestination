import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { CompareTray } from "@/components/compare-tray";
import { ConsentGatedAnalytics } from "@/components/consent-gated-analytics";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { CookiePreferencesModal } from "@/components/cookie-preferences-modal";
import { siteConfig } from "@/config/site";
import "./globals.css";

/* Geist Sans — loaded from next/font/local using the font files shipped
   by the @geist/font package or the Vercel Geist font distribution.
   We use the variable weight file for maximum flexibility. */
const geistSans = localFont({
  src: [
    {
      path: "../../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
      style: "normal",
    },
  ],
  variable: "--font-display",
  display: "swap",
});

const geistMono = localFont({
  src: [
    {
      path: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
      style: "normal",
    },
  ],
  variable: "--font-mono",
  display: "swap",
});

const geistBody = localFont({
  src: [
    {
      path: "../../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
      style: "normal",
    },
  ],
  variable: "--font-body",
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
    description: "Security hardware, specified clearly.",
    url: siteUrl,
    siteName: "DeviceDestination",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DeviceDestination",
    description: "Security hardware, specified clearly.",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF6A00",
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
    <html lang="en-IN" className={`${geistSans.variable} ${geistBody.variable} ${geistMono.variable}`}>
      <body>
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-xl bg-[var(--dark)] px-4 py-3 text-sm font-semibold text-white focus:translate-y-0 transition-transform"
        >
          Skip to content
        </a>
        <Header />
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
