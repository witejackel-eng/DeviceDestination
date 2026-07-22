import Link from "next/link";
import { siteConfig } from "@/config/site";

export function Brand({
  inverted = false,
  compact = false,
  responsive = false,
}: {
  inverted?: boolean;
  compact?: boolean;
  responsive?: boolean;
}) {
  return (
    <Link
      href="/"
      className="group inline-flex min-h-11 items-center gap-3"
      aria-label={`${siteConfig.name} home`}
    >
      <span
        aria-hidden="true"
        data-anime-brand
        className="brand-mark grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[var(--tangerine)] font-display text-sm font-black tracking-[-0.06em] text-[var(--ink)] transition-transform group-hover:-rotate-3 group-hover:scale-105"
      >
        DD
      </span>
      {!compact && (
        <span
          className={`font-display text-xl font-extrabold tracking-[-0.06em] ${responsive ? "hidden min-[430px]:inline" : ""} ${inverted ? "text-white" : "text-[var(--ink)]"}`}
        >
          Device<span className="text-[var(--tangerine-dark)]">Destination</span>
        </span>
      )}
    </Link>
  );
}
