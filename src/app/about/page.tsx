import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileText, IndianRupee, MapPin } from "lucide-react";
export const metadata: Metadata = {
  title: "About",
  description: "How DeviceDestination selects and explains security hardware.",
};
export default function AboutPage() {
  const values = [
    [BadgeCheck, "Exact over approximate", "A near-match model is not the same product."],
    [FileText, "Documentation that belongs", "Only exact-model technical files are attached."],
    [IndianRupee, "Prices without tricks", "GST is included and unverified MRPs are not invented."],
    [MapPin, "Local accountability", "Delhi NCR support with a published business address."],
  ];
  return (
    <div className="container-standard section-space !pt-14">
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="eyebrow">About DeviceDestination</p>
          <h1 className="display-section mt-4">The model number matters.</h1>
        </div>
        <div className="self-end">
          <p className="max-w-2xl text-xl leading-9 text-[var(--muted)]">
            Security hardware is full of products that look alike but behave differently.
            DeviceDestination exists to make the exact model, price, documentation and support route
            clear before you buy.
          </p>
          <Link href="/products" className="button-primary mt-7">
            Browse the catalogue
          </Link>
        </div>
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {values.map(([Icon, title, copy]) => {
          const I = Icon as typeof BadgeCheck;
          return (
            <div key={title as string} className="surface-card p-6">
              <I size={24} />
              <h2 className="mt-10 font-display text-2xl font-semibold">{title as string}</h2>
              <p className="mt-3 leading-7 text-[var(--muted)]">{copy as string}</p>
            </div>
          );
        })}
      </div>
      <section className="section-space">
        <div className="rounded-[28px] bg-[var(--ink)] p-8 text-white sm:p-14">
          <p className="eyebrow !text-white/55">What we do—and do not do</p>
          <h2 className="mt-4 max-w-4xl font-display text-5xl font-semibold leading-[1.02]">
            We sell hardware and help customers choose it. Installation remains a separate
            specialist service.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">
            Where requested, qualified third-party installers can assess and quote the site.
            DeviceDestination does not present installation as included in a product price.
          </p>
        </div>
      </section>
    </div>
  );
}
