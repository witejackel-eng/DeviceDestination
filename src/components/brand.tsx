import Link from "next/link";
import { siteConfig } from "@/config/site";
import { DDMark } from "@/components/dd-mark";

export function Brand({
  inverted = false,
  compact = false,
  responsive = false,
  compactMark = false,
}: {
  inverted?: boolean;
  compact?: boolean;
  responsive?: boolean;
  compactMark?: boolean;
}) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center ${compactMark ? "min-h-11 gap-2.5" : "min-h-11 gap-3"}`}
      aria-label={`${siteConfig.name} home`}
    >
      <span
        aria-hidden="true"
        className={`brand-mark grid shrink-0 place-items-center bg-[var(--tangerine)] text-[var(--ink)] transition-transform group-hover:-rotate-2 group-hover:scale-105 ${
          compactMark ? "h-9 w-9 rounded-[11px] p-1.5" : "h-11 w-11 rounded-[14px] p-2"
        }`}
      >
        <DDMark tone="dark" className="h-full w-full" />
      </span>
      {!compact && (
        <span
          className={`font-display font-bold tracking-[-0.025em] ${compactMark ? "text-lg" : "text-xl"} ${responsive ? "hidden min-[430px]:inline" : ""} ${inverted ? "text-white" : "text-[var(--ink)]"}`}
        >
          Device<span className="text-[var(--tangerine-text)]">Destination</span>
        </span>
      )}
    </Link>
  );
}
