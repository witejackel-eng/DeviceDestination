"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useConsentStore } from "@/lib/consent-store";
import { springs } from "@/lib/motion/constants";

export function CookieConsentBanner() {
  const reduceMotion = useReducedMotion();
  const decidedAt = useConsentStore((state) => state.decidedAt);
  const isPreferencesOpen = useConsentStore((state) => state.isPreferencesOpen);
  const acceptAll = useConsentStore((state) => state.acceptAll);
  const rejectNonEssential = useConsentStore((state) => state.rejectNonEssential);
  const openPreferences = useConsentStore((state) => state.openPreferences);
  const visible = decidedAt === null && !isPreferencesOpen;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label="Cookie consent"
          initial={reduceMotion ? false : { y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={springs.drawer}
          className="fixed inset-x-3 bottom-[calc(64px+0.75rem)] z-40 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5 shadow-2xl sm:p-6 md:inset-x-auto md:bottom-4 md:left-4 md:right-auto md:max-w-md md:rounded-[24px]"
        >
          <p className="font-display text-xl font-bold">A few cookies, nothing sneaky.</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            We use strictly necessary storage to run your cart, compare list and recently viewed
            products, plus optional analytics to see what&apos;s working. Read the{" "}
            <Link href="/cookie-policy" className="underline hover:text-[var(--text-primary)]">
              cookie policy
            </Link>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button type="button" onClick={acceptAll} className="button-primary">
              Accept all
            </button>
            <button type="button" onClick={rejectNonEssential} className="button-secondary">
              Reject non-essential
            </button>
            <button type="button" onClick={openPreferences} className="button-quiet">
              Manage preferences
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
