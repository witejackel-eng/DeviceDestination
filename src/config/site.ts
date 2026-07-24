/**
 * Resolve the canonical site URL. In production, NEXT_PUBLIC_SITE_URL must be
 * set to a real domain — Vercel preview URLs and localhost are rejected by
 * the production check and by the canonical-domain enforcement below.
 *
 * In development, fall back to localhost so the dev server works.
 */
function resolveCanonicalUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (url) return url.replace(/\/$/, ""); // strip trailing slash
  // Dev-only fallback. Never used in production (the production check fails).
  if (process.env.NODE_ENV === "production") {
    // In production without NEXT_PUBLIC_SITE_URL, use a placeholder that will
    // be caught by the production check. We don't fall back to a Vercel
    // preview URL because that would make the canonical domain incorrect.
    return "https://devicedestination.com";
  }
  return "http://localhost:3000";
}

export const siteConfig = {
  name: "DeviceDestination",
  shortName: "DD",
  tagline: "Shop exact-model security hardware.",
  description:
    "Genuine CCTV, networking, storage, and biometric systems—verified by exact model, priced with GST included, and supported across Delhi NCR.",
  url: resolveCanonicalUrl(),
  contact: {
    phoneDisplay: "+91 83685 61919",
    phoneE164: "+918368561919",
    email: "manish@insight-solutions.in",
    whatsapp: "918368561919",
  },
  address: {
    street: "Plot No. 94, 3rd Floor, Block B, Sector 13, Dwarka",
    city: "New Delhi",
    region: "Delhi",
    postalCode: "110075",
    country: "IN",
  },
  serviceArea: "Delhi NCR",
  legalName: process.env.BUSINESS_LEGAL_NAME ?? "DeviceDestination",
  gstin: process.env.BUSINESS_GSTIN ?? null,
  pricing: {
    defaultMaxAgeDays: 30,
  },
} as const;

export function getPriceMaxAgeDays() {
  const configured = Number(process.env.NEXT_PUBLIC_PRICE_MAX_AGE_DAYS);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : siteConfig.pricing.defaultMaxAgeDays;
}

/**
 * Whether the canonical site URL is a production-grade origin (not a Vercel
 * preview or localhost). Used by the production check and by SEO code to
 * decide whether to emit canonical tags and structured data.
 */
export function isCanonicalDomainProductionReady(): boolean {
  const url = siteConfig.url.toLowerCase();
  return (
    !url.includes("vercel.app") &&
    !url.includes("localhost") &&
    !url.includes("127.0.0.1") &&
    url.startsWith("https://")
  );
}
