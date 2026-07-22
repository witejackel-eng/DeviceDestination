"use client";

import { useConsentStore } from "@/lib/consent-store";

export function CookieSettingsLink({ className }: { className?: string }) {
  const openPreferences = useConsentStore((state) => state.openPreferences);
  return (
    <button type="button" onClick={openPreferences} className={className}>
      Cookie settings
    </button>
  );
}
