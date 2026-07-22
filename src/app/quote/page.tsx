import type { Metadata } from "next";
import { EnquiryForm } from "@/components/enquiry-form";
import { publicPageMetadata } from "@/lib/seo";
export const metadata: Metadata = publicPageMetadata({
  title: "Request a quote",
  description: "Request project, bulk or installation pricing for exact security hardware models.",
  path: "/quote",
});
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default async function QuotePage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const product = typeof query.product === "string" ? query.product.slice(0, 120) : "";
  return (
    <div className="container-standard section-space !pt-14">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">Project and bulk buying</p>
          <h1 className="display-section mt-4">A quote for the complete requirement.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
            Useful for storage sizing, PoE, cabling, multi-site quantities or hardware that requires
            site-specific pricing. Installation is assessed separately.
          </p>
        </div>
        <EnquiryForm
          type="quote"
          title={product ? `Confirm ${product}` : "Describe the requirement"}
          buttonLabel={product ? "Request latest price" : "Request quote"}
          initialMessage={
            product ? `Please confirm the current price and availability for ${product}.` : ""
          }
        />
      </div>
    </div>
  );
}
