"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { hasAnalyticsConsent, useConsentStore } from "@/lib/consent-store";

export function ConsentGatedAnalytics() {
  const consented = useConsentStore(hasAnalyticsConsent);
  if (!consented) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
