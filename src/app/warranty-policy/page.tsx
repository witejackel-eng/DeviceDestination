import type { Metadata } from "next";
import { EditorialPage } from "@/components/editorial-page";
export const metadata: Metadata = { title: "Warranty policy" };
export default function WarrantyPage() {
  return (
    <EditorialPage
      eyebrow="Policy"
      title="Warranty policy"
      intro="Warranty is model-specific and governed by the applicable OEM terms."
      sections={[
        {
          title: "Proof required",
          body: (
            <p>
              Keep the GST invoice, model label and serial number. Warranty eligibility may depend
              on purchase channel, product registration and installation conditions.
            </p>
          ),
        },
        {
          title: "What is covered",
          body: (
            <p>
              The manufacturer decides whether a fault is covered and whether it is repaired or
              replaced. Consumables, physical damage, misuse and external power or network faults
              are generally excluded.
            </p>
          ),
        },
        {
          title: "Service route",
          body: (
            <p>
              Contact us with the order number, exact model, serial and fault description. We will
              guide you to the appropriate support or service-centre process.
            </p>
          ),
        },
        {
          title: "Installation faults",
          body: (
            <p>
              Installation workmanship is separate from OEM product warranty and should be raised
              with the installer responsible for the site work.
            </p>
          ),
        },
      ]}
    />
  );
}
