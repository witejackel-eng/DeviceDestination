import { HeroDeviceArt, type HeroDevice } from "@/components/hero-illustration";
import { PointerField } from "@/components/pointer-field";

const positions = [
  "col-span-2 row-span-4",
  "col-span-2 row-span-2",
  "col-span-1 row-span-2",
  "col-span-1 row-span-2",
];

const tiles = ["var(--peach)", "var(--sage)", "var(--sky)", "var(--sand)"];

const devices: HeroDevice[] = ["dome", "nvr", "biometric", "poe"];

export function HeroProducts() {
  return (
    <div
      className="relative grid h-[360px] grid-cols-4 grid-rows-4 gap-2.5 sm:h-[480px] lg:h-[590px] lg:gap-3"
      aria-label="Illustrated CCTV, recording, biometric and networking hardware"
    >
      <PointerField className="absolute inset-0 -z-10 rounded-[24px]" />
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
      {devices.map((device, index) => (
        <div
          key={device}
          data-hero-product
          className={`relative overflow-hidden rounded-[18px] border border-[var(--line)] shadow-[0_18px_50px_rgb(23_20_17/0.08)] ${positions[index]}`}
          style={{ background: tiles[index] }}
        >
          <HeroDeviceArt device={device} />
        </div>
      ))}
    </div>
  );
}
