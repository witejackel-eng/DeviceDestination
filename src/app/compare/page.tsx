import type { Metadata } from "next";
import { ComparisonPage } from "@/components/comparison-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Compare exact product models",
  description: "Compare up to four exact CCTV, NVR or biometric models in a shareable table.",
  path: "/compare",
  noIndex: true,
});
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ids = typeof params.ids === "string" ? params.ids.split(",").slice(0, 4) : [];
  return <ComparisonPage initialIds={ids} />;
}
