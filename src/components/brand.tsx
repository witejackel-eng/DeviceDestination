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
  /* Full horizontal logo: monogram + "DeviceDestination" wordmark on one line.
     Light-bg version: entire "DeviceDestination" in charcoal, orange only in monogram aperture.
     Dark-bg version: white wordmark, charcoal/white monogram strokes, orange aperture.
     Do not colour the whole "Destination" word orange in the primary header. */

  const wordmarkColor = inverted ? "text-white" : "text-[var(--text-primary)]";

  return (
    <Link
      href="/"
      className={`group inline-flex items-center ${compactMark ? "min-h-11 gap-2.5" : "min-h-11 gap-3"}`}
      aria-label={`${siteConfig.name} home`}
    >
      <span
        aria-hidden="true"
        className={`shrink-0 transition-transform duration-200 group-hover:scale-105 ${
          compactMark ? "h-8 w-8" : "h-[30px] w-[30px]"
        }`}
      >
        <DDMark tone={inverted ? "light" : "brand"} className="h-full w-full" />
      </span>
      {!compact && (
        <span
          className={`font-display font-semibold tracking-[-0.025em] ${compactMark ? "text-[17px]" : "text-[17px]"} ${responsive ? "hidden min-[430px]:inline" : ""} ${wordmarkColor}`}
        >
          DeviceDestination
        </span>
      )}
    </Link>
  );
}
