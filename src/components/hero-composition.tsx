import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, PackageCheck, Truck } from "lucide-react";
import type { Product } from "@/lib/products";
import { formatPrice } from "@/lib/products";

/**
 * The hero product arrangement. Every image, model number, price and stock state
 * here is read from the catalogue the storefront actually sells — nothing is a
 * placeholder, a render, or an image borrowed from a different model.
 */
export function HeroComposition({
  hero,
  behind,
  beside,
}: {
  hero: Product;
  behind?: Product;
  beside?: Product;
}) {
  return (
    <div className="relative">
      <div className="relative mx-auto aspect-[1.06] w-full max-w-[620px]">
        {/* Supporting products sit behind and to the side, smaller and quieter,
            so the dominant product keeps the eye. */}
        {behind && (
          <Link
            href={`/products/${behind.slug}`}
            className="absolute left-0 top-[6%] w-[46%] rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[0_16px_44px_rgb(23_20_17/0.07)] transition-transform duration-500 hover:-translate-y-1"
          >
            <span className="relative block aspect-[1.25]">
              <Image
                src={behind.images[0]}
                alt={`${behind.brand} ${behind.model} network video recorder`}
                fill
                sizes="(max-width: 768px) 40vw, 280px"
                className="object-contain"
              />
            </span>
            <span className="mt-2 block truncate text-[11px] font-bold text-[var(--tangerine-text)]">
              {behind.model}
            </span>
          </Link>
        )}

        {beside && (
          <Link
            href={`/products/${beside.slug}`}
            className="absolute bottom-[4%] right-0 w-[38%] rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[0_16px_44px_rgb(23_20_17/0.07)] transition-transform duration-500 hover:-translate-y-1"
          >
            <span className="relative block aspect-square">
              <Image
                src={beside.images[0]}
                alt={`${beside.brand} ${beside.model} biometric terminal`}
                fill
                sizes="(max-width: 768px) 34vw, 220px"
                className="object-contain"
              />
            </span>
            <span className="mt-2 block truncate text-[11px] font-bold text-[var(--tangerine-text)]">
              {beside.model}
            </span>
          </Link>
        )}

        {/* Dominant product. `priority` because it is the hero LCP candidate. */}
        <Link
          href={`/products/${hero.slug}`}
          className="absolute left-1/2 top-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2"
        >
          <span className="relative block aspect-square drop-shadow-[0_28px_46px_rgb(23_20_17/0.16)]">
            <Image
              src={hero.images[0]}
              alt={`${hero.brand} ${hero.model} network camera`}
              fill
              priority
              sizes="(max-width: 768px) 62vw, 420px"
              className="object-contain"
            />
          </span>
        </Link>
      </div>

      <FloatingCards hero={hero} behind={behind} />
    </div>
  );
}

/**
 * Commerce cards drawn from the same records. On tablet and mobile they leave
 * the absolute layer and become a plain row/stack beneath the composition, so
 * they can never cover the headline or the primary actions.
 */
function FloatingCards({ hero, behind }: { hero: Product; behind?: Product }) {
  const cards = [
    {
      key: "stock",
      icon: PackageCheck,
      label: hero.stockStatus === "in_stock" ? "Available now" : "Check lead time",
      value: hero.model,
      hint: hero.category,
      position: "lg:-left-6 lg:top-[10%]",
    },
    {
      key: "price",
      icon: BadgeCheck,
      label: formatPrice(hero.sellingPriceInclGstPaise),
      value: "Inclusive of GST",
      hint: "Manufacturer specifications",
      position: "lg:-right-4 lg:top-[38%]",
    },
    {
      key: "delivery",
      icon: Truck,
      label: "Delivery support",
      value: behind ? `${behind.model} in stock` : "Check your PIN code",
      hint: "Dispatch confirmed at checkout",
      position: "lg:bottom-[6%] lg:left-[4%]",
    },
  ] as const;

  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-3 lg:mt-0 lg:block">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <li
            key={card.key}
            className={`flex items-start gap-3 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-[0_14px_38px_rgb(23_20_17/0.08)] lg:absolute lg:w-[220px] ${card.position}`}
          >
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[var(--tangerine-soft)] text-[var(--tangerine-text)]">
              <Icon size={16} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{card.label}</span>
              <span className="block truncate text-xs font-semibold text-[var(--ink-soft)]">
                {card.value}
              </span>
              <span className="block truncate text-[11px] text-[var(--muted)]">{card.hint}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
