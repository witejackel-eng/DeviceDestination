export const siteConfig = {
  name: "DeviceDestination",
  shortName: "DD",
  tagline: "Shop exact-model security hardware.",
  description:
    "Genuine CCTV, networking, storage, and biometric systems—verified by exact model, priced with GST included, and supported across Delhi NCR.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://device-destination-rose.vercel.app",
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
