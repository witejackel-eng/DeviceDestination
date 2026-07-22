"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { catalogue } from "@/data/catalog";
import { comparisonGroup } from "@/lib/products";

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
        set((state) => {
          if (state.ids.includes(id)) return { ids: state.ids.filter((item) => item !== id) };
          const candidate = catalogue.find((product) => product.id === id);
          const first = catalogue.find((product) => product.id === state.ids[0]);
          const compatible =
            candidate && (!first || comparisonGroup(candidate) === comparisonGroup(first));
          return {
            ids: compatible && state.ids.length < MAX_COMPARE ? [...state.ids, id] : state.ids,
          };
        }),
      remove: (id) => set((state) => ({ ids: state.ids.filter((item) => item !== id) })),
      clear: () => set({ ids: [] }),
      replace: (ids) => {
        const existing = Array.from(new Set(ids)).flatMap((id) => {
          const product = catalogue.find((item) => item.id === id);
          return product ? [product] : [];
        });
        const group = existing[0] ? comparisonGroup(existing[0]) : null;
        set({
          ids: existing
            .filter((product) => !group || comparisonGroup(product) === group)
            .slice(0, MAX_COMPARE)
            .map((product) => product.id),
        });
      },
    }),
    { name: "devicedestination-compare-v1" },
  ),
);
