import type { Metadata } from "next";
import { EditorialPage } from "@/components/editorial-page";
export const metadata: Metadata = { title: "Shipping policy" };
export default function ShippingPage() {
  return (
    <EditorialPage
      eyebrow="Policy"
      title="Shipping policy"
      intro="Delivery timing and charges are confirmed against product availability and destination."
      sections={[
        {
          title: "Dispatch",
          body: (
            <p>
              In-stock status is indicative until the order is checked. We confirm availability and
              expected dispatch timing before fulfilment.
            </p>
          ),
        },
        {
          title: "Delivery charges",
          body: (
            <p>
              Checkout currently shows ₹0 shipping for supported orders. Oversized, remote or
              project deliveries may require a separate quotation before payment.
            </p>
          ),
        },
        {
          title: "Inspection",
          body: (
            <p>
              Inspect packaging, model labels and quantity at delivery. Report visible transit
              damage promptly with photos and the order number.
            </p>
          ),
        },
        {
          title: "Delays",
          body: (
            <p>
              Carrier or manufacturer delays are communicated using the contact details on the
              order. Installation should not be scheduled until hardware is received and checked.
            </p>
          ),
        },
      ]}
    />
  );
}
