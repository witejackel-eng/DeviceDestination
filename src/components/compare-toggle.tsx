"use client";

import { Check, Scale } from "lucide-react";
import { catalogue } from "@/data/catalog";
import { useCompareStore } from "@/lib/compare-store";
import { comparisonGroup } from "@/lib/products";

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
  const candidate = catalogue.find((product) => product.id === productId);
  const first = catalogue.find((product) => product.id === ids[0]);
  const incompatible = Boolean(
    !selected && first && candidate && comparisonGroup(first) !== comparisonGroup(candidate),
  );
  return (
    <button
      type="button"
      onClick={() => toggle(productId)}
      disabled={atLimit || incompatible}
      className={
        compact
          ? "inline-flex items-center gap-1.5 min-h-11 text-xs font-bold text-[var(--muted)] disabled:opacity-45 transition-colors hover:text-[var(--ink)]"
          : "button-secondary w-full"
      }
      aria-pressed={selected}
      title={
        atLimit
          ? "Compare up to four products"
          : incompatible
            ? "Choose another product of the same type"
            : undefined
      }
    >
      {selected ? <Check size={14} /> : <Scale size={14} />}
      {selected
        ? "Added to compare"
        : atLimit
          ? "Compare limit reached"
          : incompatible
            ? "Different product type"
            : "Add to compare"}
    </button>
  );
}
