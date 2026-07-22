import type { Metadata } from "next";
import { EditorialPage } from "@/components/editorial-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Cookie policy",
  description: "What DeviceDestination stores in your browser, and how to change your choice.",
  path: "/cookie-policy",
});

export default function CookiePolicyPage() {
  return (
    <EditorialPage
      eyebrow="Policy"
      title="Cookie policy"
      intro="What this site stores in your browser, why, and how to change your choice."
      sections={[
        {
          title: "Strictly necessary (always on)",
          body: (
            <p>
              Your cart, compare list and recently viewed products are stored in your browser so
              they persist between visits. Signing in uses a secure, HTTP-only session cookie.
              None of this can be switched off without breaking the ability to shop.
            </p>
          ),
        },
        {
          title: "Analytics (optional)",
          body: (
            <p>
              With your consent, Vercel Analytics and Speed Insights measure page views and load
              performance so we know which pages are useful. They only run in production and only
              after you accept analytics below. We do not use advertising or cross-site tracking
              cookies.
            </p>
          ),
        },
        {
          title: "Payment processing",
          body: (
            <p>
              Razorpay&apos;s checkout script only loads when you start a payment, and Razorpay may
              set its own cookies on its own domain to process that payment securely. This is
              required to complete a purchase and is not part of the analytics choice below.
            </p>
          ),
        },
        {
          title: "Changing your choice",
          body: (
            <p>
              Use the &ldquo;Cookie settings&rdquo; link in the footer at any time to accept, reject
              or change analytics storage.
            </p>
          ),
        },
      ]}
    />
  );
}
