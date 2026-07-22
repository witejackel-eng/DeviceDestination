import { describe, expect, it, beforeEach } from "vitest";
import {
  CONSENT_VERSION,
  hasAnalyticsConsent,
  migrateConsent,
  useConsentStore,
} from "@/lib/consent-store";

describe("cookie consent store", () => {
  beforeEach(() => {
    useConsentStore.setState({ analytics: false, decidedAt: null, isPreferencesOpen: false });
  });

  it("starts undecided with analytics off", () => {
    const state = useConsentStore.getState();
    expect(state.decidedAt).toBeNull();
    expect(state.analytics).toBe(false);
    expect(hasAnalyticsConsent(state)).toBe(false);
  });

  it("accepting all grants analytics consent and records a timestamp", () => {
    useConsentStore.getState().acceptAll();
    const state = useConsentStore.getState();
    expect(state.analytics).toBe(true);
    expect(state.decidedAt).not.toBeNull();
    expect(hasAnalyticsConsent(state)).toBe(true);
  });

  it("rejecting non-essential keeps analytics off but still records a decision", () => {
    useConsentStore.getState().rejectNonEssential();
    const state = useConsentStore.getState();
    expect(state.analytics).toBe(false);
    expect(state.decidedAt).not.toBeNull();
    expect(hasAnalyticsConsent(state)).toBe(false);
  });

  it("setAnalytics records an explicit preference change", () => {
    useConsentStore.getState().setAnalytics(true);
    expect(hasAnalyticsConsent(useConsentStore.getState())).toBe(true);
    useConsentStore.getState().setAnalytics(false);
    expect(hasAnalyticsConsent(useConsentStore.getState())).toBe(false);
  });

  it("opens and closes the preferences modal", () => {
    useConsentStore.getState().openPreferences();
    expect(useConsentStore.getState().isPreferencesOpen).toBe(true);
    useConsentStore.getState().closePreferences();
    expect(useConsentStore.getState().isPreferencesOpen).toBe(false);
  });

  it("migrates a stale persisted payload back to the default state", () => {
    const stale = { analytics: true, decidedAt: "2020-01-01T00:00:00.000Z" };
    expect(migrateConsent(stale, CONSENT_VERSION - 1)).toEqual({
      analytics: false,
      decidedAt: null,
    });
  });

  it("passes through an already-current persisted payload unchanged", () => {
    const current = { analytics: true, decidedAt: "2026-07-01T00:00:00.000Z" };
    expect(migrateConsent(current, CONSENT_VERSION)).toEqual(current);
  });
});
