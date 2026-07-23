import type { Metadata } from "next";
import { SystemBuilder } from "@/components/system-builder";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "CCTV system builder",
  description:
    "Build a compatible CCTV starting set by property, camera count, resolution and recording needs.",
  path: "/system-builder",
});
export default function SystemBuilderPage() {
  return (
    <div className="container-standard section-space !pt-14">
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">Guided selection</p>
          <h1 className="display-section mt-4">Build a compatible starting set.</h1>
        </div>
        <p className="max-w-2xl self-end text-lg leading-8 text-[var(--text-muted)]">
          This builder prevents obvious channel and camera mismatches. Storage, PoE and cabling
          still require site-specific sizing.
        </p>
      </div>
      <div className="mt-12">
        <SystemBuilder />
      </div>
    </div>
  );
}
