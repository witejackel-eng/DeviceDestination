"use client";

import { Check, Scale } from "lucide-react";
import { useCompareStore } from "@/lib/compare-store";

export function CompareToggle({
  productId,
  compact = false,
}: {
  productId: string;
  compact?: boolean;
}) {
  const ids = useCompareStore((state) => state.ids);
  const toggle = useCompareStore((state) => state.toggle);
  const selected = ids.includes(productId);
  const atLimit = ids.length >= 4 && !selected;
  return (
    <button
      type="button"
      onClick={() => toggle(productId)}
      disabled={atLimit}
      className={
        compact
          ? "inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--muted)] disabled:opacity-45"
          : "button-secondary w-full"
      }
      aria-pressed={selected}
      title={atLimit ? "Compare up to four products" : undefined}
    >
      {selected ? <Check size={16} /> : <Scale size={16} />}
      {selected ? "Added to compare" : atLimit ? "Compare limit reached" : "Add to compare"}
    </button>
  );
}
