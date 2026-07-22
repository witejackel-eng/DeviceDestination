import type { Metadata } from "next";
import { EnquiryForm } from "@/components/enquiry-form";
export const metadata: Metadata = {
  title: "Request a quote",
  description: "Request project, bulk or installation pricing for exact security hardware models.",
};
export default function QuotePage() {
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
        <EnquiryForm type="quote" title="Describe the requirement" buttonLabel="Request quote" />
      </div>
    </div>
  );
}
