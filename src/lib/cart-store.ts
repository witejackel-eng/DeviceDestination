"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = { productId: string; quantity: number };

type CartState = {
  items: CartLine[];
  isOpen: boolean;
  addItem: (productId: string, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      addItem: (productId, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((item) => item.productId === productId);
          return {
            isOpen: true,
            items: existing
              ? state.items.map((item) =>
                  item.productId === productId
                    ? { ...item, quantity: Math.min(99, item.quantity + quantity) }
                    : item,
                )
              : [...state.items, { productId, quantity }],
          };
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items
            .map((item) => (item.productId === productId ? { ...item, quantity } : item))
            .filter((item) => item.quantity > 0),
        })),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: "devicedestination-cart-v1",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
