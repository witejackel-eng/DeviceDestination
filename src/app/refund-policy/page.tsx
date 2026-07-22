import type { Metadata } from "next";
import { EditorialPage } from "@/components/editorial-page";
import { publicPageMetadata } from "@/lib/seo";
export const metadata: Metadata = publicPageMetadata({
  title: "Refund and return policy",
  description:
    "Return eligibility, reporting windows and refund conditions for exact-model hardware.",
  path: "/refund-policy",
});
export default function RefundPage() {
  return (
    <EditorialPage
      eyebrow="Policy"
      title="Refund and return policy"
      intro="Returns depend on product condition, model eligibility and manufacturer or distributor rules."
      sections={[
        {
          title: "Report an issue",
          body: (
            <p>
              Contact us within 48 hours of delivery for a wrong model, shortage or visible transit
              damage. Keep original packaging and provide clear photos or video.
            </p>
          ),
        },
        {
          title: "Eligible returns",
          body: (
            <p>
              Unused, sealed items may be eligible after verification. Opened, installed,
              registered, damaged or special-order products may not be returnable unless defective.
            </p>
          ),
        },
        {
          title: "Defective products",
          body: (
            <p>
              Defects are handled under the applicable OEM warranty or replacement process. Testing
              and manufacturer confirmation may be required.
            </p>
          ),
        },
        {
          title: "Refund timing",
          body: (
            <p>
              Approved refunds are issued to the original method after the returned item and
              documentation are checked. Bank settlement time is outside our control.
            </p>
          ),
        },
      ]}
    />
  );
}
