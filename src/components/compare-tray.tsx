"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Scale, X } from "lucide-react";
import { catalogue } from "@/data/catalog";
import { useCompareStore } from "@/lib/compare-store";
import { springs } from "@/lib/motion/constants";

export function CompareTray() {
  const reduceMotion = useReducedMotion();
  const ids = useCompareStore((state) => state.ids);
  const remove = useCompareStore((state) => state.remove);
  const clear = useCompareStore((state) => state.clear);
  const selected = ids.flatMap((id) => {
    const product = catalogue.find((item) => item.id === id);
    return product ? [product] : [];
  });
  return (
    <AnimatePresence>
      {selected.length > 0 && (
        <motion.aside
          initial={reduceMotion ? false : { opacity: 0, y: 26, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.99 }}
          transition={springs.interface}
          className="fixed inset-x-3 bottom-3 z-[65] mx-auto max-w-4xl rounded-[20px] border border-white/15 bg-[var(--ink)] p-3 text-white shadow-2xl sm:inset-x-6"
          aria-label="Product comparison tray"
        >
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 px-2 sm:flex">
              <Scale size={18} className="text-[var(--tangerine)]" />
              <span className="text-sm font-bold">Compare {selected.length}/4</span>
            </div>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
              <AnimatePresence initial={false}>
                {selected.map((product) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex shrink-0 items-center gap-2 rounded-xl bg-white/10 p-2 pr-3"
                  >
                    <span className="relative h-9 w-9 overflow-hidden rounded-lg bg-white">
                      <Image
                        src={product.images[0]}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-contain p-1"
                      />
                    </span>
                    <span className="max-w-28 truncate text-xs font-bold">{product.model}</span>
                    <button
                      type="button"
                      onClick={() => remove(product.id)}
                      className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"
                      aria-label={`Remove ${product.model} from comparison`}
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <button
              type="button"
              onClick={clear}
              className="hidden min-h-11 px-2 text-xs text-white/65 hover:text-white sm:block"
            >
              Clear
            </button>
            <Link
              href={`/compare?ids=${selected.map((product) => product.id).join(",")}`}
              className="button-primary shrink-0 px-4"
            >
              Compare <span className="sm:hidden">{selected.length}</span>
            </Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
