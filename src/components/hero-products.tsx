import Image from "next/image";
import type { Product } from "@/lib/products";

const positions = [
  "col-span-2 row-span-2",
  "col-span-2 row-span-1",
  "col-span-1 row-span-2",
  "col-span-1 row-span-1",
  "col-span-2 row-span-1",
  "col-span-1 row-span-1",
];

const tiles = [
  "var(--peach)",
  "var(--sage)",
  "var(--sky)",
  "var(--sand)",
  "var(--tangerine-soft)",
  "#e8ede0",
];

export function HeroProducts({ products }: { products: Product[] }) {
  return (
    <div
      className="relative grid h-[430px] grid-cols-4 grid-rows-4 gap-2.5 sm:h-[540px] lg:h-[650px] lg:gap-3"
      aria-label="Cameras, recording, biometric and networking products"
    >
      <svg
        viewBox="0 0 600 600"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      >
        <path
          data-anime-hero-path
          d="M80 168 C175 72 260 245 346 146 S490 98 536 210 C564 278 476 334 388 316 S220 282 144 394 C100 460 180 514 300 492"
          fill="none"
          stroke="var(--tangerine)"
          strokeWidth="3"
          strokeDasharray="650"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
      {products.slice(0, 6).map((product, index) => (
        <div
          key={product.id}
          data-hero-product
          className={`relative overflow-hidden rounded-[18px] border border-[var(--line)] shadow-[0_18px_50px_rgb(23_20_17/0.08)] ${positions[index]}`}
          style={{ background: tiles[index] }}
        >
          <Image
            src={product.images[0]}
            alt={`${product.brand} ${product.model}`}
            fill
            priority={index < 2}
            sizes="(max-width: 1024px) 42vw, 25vw"
            className="object-contain p-3 sm:p-5"
          />
          {index < 4 && (
            <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-white/92 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.07em] sm:bottom-3 sm:left-3 sm:text-[10px]">
              {product.model}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
