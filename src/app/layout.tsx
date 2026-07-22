import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.devicedestination.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DeviceDestination — Security hardware, selected with care",
    template: "%s | DeviceDestination",
  },
  description:
    "Genuine CCTV, networking, storage, and biometric systems—verified by model, priced transparently, and supported across Delhi NCR.",
  alternates: { canonical: "/" },
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "DeviceDestination",
    url: siteUrl,
    email: "manish@insight-solutions.in",
    telephone: "+918368561919",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Plot No. 94, 3rd Floor, Block B, Sector 13, Dwarka",
      addressLocality: "New Delhi",
      addressRegion: "Delhi",
      postalCode: "110075",
      addressCountry: "IN",
    },
  };

  return (
    <html lang="en-IN" className={`${manrope.variable} ${dmSans.variable}`}>
      <body>
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-[var(--ink)] px-4 py-3 text-white focus:translate-y-0"
        >
          Skip to content
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
        <CartDrawer />
        {process.env.VERCEL && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
        />
      </body>
    </html>
  );
}
