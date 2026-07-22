"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CONSENT_VERSION = 1;

type PersistedConsent = {
  analytics: boolean;
  decidedAt: string | null;
};

type ConsentState = PersistedConsent & {
  isPreferencesOpen: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  setAnalytics: (value: boolean) => void;
  openPreferences: () => void;
  closePreferences: () => void;
};

const defaultConsent: PersistedConsent = { analytics: false, decidedAt: null };

export function migrateConsent(persisted: unknown, version: number): PersistedConsent {
  if (version < CONSENT_VERSION) return { ...defaultConsent };
  return persisted as PersistedConsent;
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      ...defaultConsent,
      isPreferencesOpen: false,
      acceptAll: () => set({ analytics: true, decidedAt: new Date().toISOString() }),
      rejectNonEssential: () => set({ analytics: false, decidedAt: new Date().toISOString() }),
      setAnalytics: (value) => set({ analytics: value, decidedAt: new Date().toISOString() }),
      openPreferences: () => set({ isPreferencesOpen: true }),
      closePreferences: () => set({ isPreferencesOpen: false }),
    }),
    {
      name: "devicedestination-consent-v1",
      version: CONSENT_VERSION,
      partialize: (state) => ({ analytics: state.analytics, decidedAt: state.decidedAt }),
      migrate: migrateConsent,
    },
  ),
);

export function hasAnalyticsConsent(state: Pick<ConsentState, "analytics" | "decidedAt">) {
  return state.decidedAt !== null && state.analytics;
}
