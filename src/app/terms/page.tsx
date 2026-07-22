import type { Metadata } from "next";
import { EditorialPage } from "@/components/editorial-page";
export const metadata: Metadata = { title: "Terms and conditions" };
export default function TermsPage() {
  return (
    <EditorialPage
      eyebrow="Policy"
      title="Terms and conditions"
      intro="The practical conditions that apply when you order hardware or request a quote."
      sections={[
        {
          title: "Product identity",
          body: (
            <p>
              Your order is for the exact model listed in the confirmation. Product appearance may
              vary by manufacturer revision without changing the model specification.
            </p>
          ),
        },
        {
          title: "Prices and tax",
          body: (
            <p>
              Displayed selling prices include applicable GST. Quotations may have their own
              validity period. Clear pricing mistakes may be corrected before dispatch with your
              approval or a full refund.
            </p>
          ),
        },
        {
          title: "Compatibility",
          body: (
            <p>
              Compatibility depends on the complete system. Where you supply only a partial
              requirement, confirm recorder, power, network and storage compatibility before
              purchase.
            </p>
          ),
        },
        {
          title: "Installation",
          body: (
            <p>
              Installation is not included unless a separate written quotation says so. Third-party
              installers remain responsible for their site work and quoted scope.
            </p>
          ),
        },
      ]}
    />
  );
}
