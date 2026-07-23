/**
 * Modal-layer coordination — shared state for mutual exclusion,
 * scroll locking, and z-index hierarchy between menu and cart overlays.
 *
 * Only menu and cart need coordination. Other overlays (search, cookie prefs)
 * operate independently.
 */

import { create } from "zustand";

type ModalKind = "menu" | "cart" | null;

type ModalLayerState = {
  /** Which modal is currently open (null = none) */
  active: ModalKind;
  /** Request to open a modal (closes any existing one first) */
  requestOpen: (kind: ModalKind) => void;
  /** Request to close a specific modal */
  requestClose: (kind: ModalKind) => void;
  /** Close whatever is currently open */
  closeAll: () => void;
};

export const useModalLayer = create<ModalLayerState>()((set) => ({
  active: null,
  requestOpen: (kind) =>
    set(() => ({
      // Close any existing modal before opening the new one
      active: kind,
    })),
  requestClose: (kind) =>
    set((state) => ({
      // Only close if the requested kind matches what's actually open
      active: state.active === kind ? null : state.active,
    })),
  closeAll: () => set({ active: null }),
}));

/**
 * Z-index hierarchy for modal layers:
 *
 * Header:             50
 * Compare tray:       65
 * Modal overlay:      200
 * Modal panel:        210
 * External close btn: 220
 * Skip-to-content:    100 (above header, below modal overlay)
 * Cookie banner:      40 (below header)
 *
 * This ensures menu/cart always render above everything except
 * critical accessibility controls.
 */
export const MODAL_Z = {
  overlay: 200,
  panel: 210,
  closeControl: 220,
} as const;

/**
 * Scroll-lock utility.
 * Preserves scrollbar width to prevent page jump.
 * Uses data-scroll-lock attribute which is handled by globals.css.
 */
export function lockScroll() {
  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;
  document.body.setAttribute("data-scroll-lock", "true");
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
}

export function unlockScroll() {
  document.body.removeAttribute("data-scroll-lock");
  document.body.style.paddingRight = "";
}
