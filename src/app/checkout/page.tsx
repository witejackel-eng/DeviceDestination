import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";

export const metadata: Metadata = {
  title: "Secure checkout",
  robots: { index: false, follow: false },
};
export default function CheckoutPage() {
  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Guest checkout</p>
      <h1 className="display-section mt-4">Complete your order.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
        No account required. Product prices include GST; installation remains separate.
      </p>
      <div className="mt-10">
        <CheckoutForm />
      </div>
    </div>
  );
}
