"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_COMPARE = 4;

type CompareState = {
  ids: string[];
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  replace: (ids: string[]) => void;
};

export const useCompareStore = create<CompareState>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (id) =>
        set((state) => ({
          ids: state.ids.includes(id)
            ? state.ids.filter((item) => item !== id)
            : state.ids.length < MAX_COMPARE
              ? [...state.ids, id]
              : state.ids,
        })),
      remove: (id) => set((state) => ({ ids: state.ids.filter((item) => item !== id) })),
      clear: () => set({ ids: [] }),
      replace: (ids) => set({ ids: Array.from(new Set(ids)).slice(0, MAX_COMPARE) }),
    }),
    { name: "devicedestination-compare-v1" },
  ),
);
