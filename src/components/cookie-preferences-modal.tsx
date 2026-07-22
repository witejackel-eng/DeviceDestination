"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Checkbox from "@radix-ui/react-checkbox";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { useConsentStore } from "@/lib/consent-store";
import { durations, springs } from "@/lib/motion/constants";

export function CookiePreferencesModal() {
  const reduceMotion = useReducedMotion();
  const isOpen = useConsentStore((state) => state.isPreferencesOpen);
  const analytics = useConsentStore((state) => state.analytics);
  const closePreferences = useConsentStore((state) => state.closePreferences);
  const setAnalytics = useConsentStore((state) => state.setAnalytics);
  const [analyticsOverride, setAnalyticsOverride] = useState<boolean | null>(null);
  const pendingAnalytics = analyticsOverride ?? analytics;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closePreferences();
          setAnalyticsOverride(null);
        }
      }}
    >
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[80] bg-black/30"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durations.fast }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-x-3 top-1/2 z-[90] mx-auto max-w-lg -translate-y-1/2 rounded-[24px] bg-[var(--canvas)] p-6 shadow-2xl sm:p-7"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={springs.interface}
              >
                <div className="flex items-center justify-between">
                  <Dialog.Title className="font-display text-2xl font-bold">
                    Cookie preferences
                  </Dialog.Title>
                  <Dialog.Close
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)]"
                    aria-label="Close cookie preferences"
                  >
                    <X size={20} />
                  </Dialog.Close>
                </div>
                <Dialog.Description className="mt-2 text-sm text-[var(--muted)]">
                  Choose what DeviceDestination can store in your browser.
                </Dialog.Description>

                <div className="mt-6 grid gap-4">
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--line)] p-4">
                    <div>
                      <p className="font-semibold">Strictly necessary</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Keeps your cart, compare list, recently viewed products and signed-in
                        session working. Always on.
                      </p>
                    </div>
                    <Checkbox.Root
                      checked
                      disabled
                      className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--tangerine-subtle)]"
                      aria-label="Strictly necessary storage, always enabled"
                    >
                      <Checkbox.Indicator>
                        <Check size={15} className="text-[var(--tangerine-text)]" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                  </div>

                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--line)] p-4">
                    <div>
                      <p className="font-semibold">Analytics</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Vercel Analytics and Speed Insights, used to see which pages are useful.
                        No advertising or cross-site tracking.
                      </p>
                    </div>
                    <Checkbox.Root
                      checked={pendingAnalytics}
                      onCheckedChange={(checked) => setAnalyticsOverride(checked === true)}
                      className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-white data-[state=checked]:bg-[var(--tangerine-subtle)]"
                      aria-label="Analytics storage"
                    >
                      <Checkbox.Indicator>
                        <Check size={15} className="text-[var(--tangerine-text)]" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                  </div>
                </div>

                <button
                  type="button"
                  className="button-primary mt-6 w-full"
                  onClick={() => {
                    setAnalytics(pendingAnalytics);
                    closePreferences();
                    setAnalyticsOverride(null);
                  }}
                >
                  Save preferences
                </button>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
