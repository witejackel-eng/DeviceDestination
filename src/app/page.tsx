import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, BadgeCheck, FileText, IndianRupee, ShieldCheck, Wrench } from "lucide-react";
import { catalogue, categories } from "@/data/catalog";
import { ProductCard } from "@/components/product-card";
import { HeroProducts } from "@/components/hero-products";
import { HomeMotion } from "@/components/home-motion";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Security hardware, selected with care",
  description:
    "Shop exact-model CCTV, NVR and biometric hardware with GST-inclusive pricing and Delhi NCR support.",
  path: "/",
});

const requirements = [
  [
    "Home security",
    "Entrances, living spaces, balconies and parking—without overbuying.",
    "home-security",
    "var(--peach)",
  ],
  [
    "Retail shops",
    "Clear counter coverage, entrance detail and simple remote viewing.",
    "retail-shops",
    "var(--sage)",
  ],
  [
    "Offices",
    "Attendance, access and surveillance hardware that works together.",
    "offices",
    "var(--sky)",
  ],
  [
    "Warehouses",
    "Longer sight lines, robust storage and channel planning.",
    "warehouses",
    "var(--sand)",
  ],
  ["Schools", "Practical monitoring and attendance for busy institutions.", "schools", "#f4e2d8"],
  [
    "Apartment societies",
    "Shared entrances, gates, parking and common-area coverage.",
    "apartments",
    "#e7eadf",
  ],
];

const faq = [
  [
    "Do your prices include GST?",
    "Yes. Every displayed selling price is the final product price including GST. Checkout does not add GST a second time.",
  ],
  [
    "Is installation included?",
    "No. Hardware and installation are kept separate. Installation can be requested and is quoted by a qualified third-party installer after the site requirements are understood.",
  ],
  [
    "How do I know products are compatible?",
    "Use the system builder or speak with us before ordering. Channel count, storage, PoE and recording-day assumptions are checked as one system.",
  ],
  [
    "Do products have OEM warranty?",
    "Applicable OEM warranty terms are shown by model. Warranty service remains subject to the manufacturer’s policy, invoice and product eligibility.",
  ],
  [
    "Can I download technical documents?",
    "Yes. A datasheet or manual button appears only where an exact-model document is available.",
  ],
  [
    "Can businesses request bulk pricing?",
    "Yes. Use Request a quote for multi-site, institutional or project quantities.",
  ],
];

export default function Home() {
  return (
    <>
      <HomeMotion />
      <section className="overflow-hidden border-b border-[var(--line)]">
        <div className="container-standard grid min-h-[calc(100svh-105px)] items-center gap-10 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:py-10">
          <div className="relative z-10">
            <div className="inline-flex items-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--ink)] text-white">
              <span className="bg-[var(--tangerine)] px-3 py-2 text-xs font-black tracking-[-0.04em] text-[var(--ink)]">
                DD
              </span>
              <span className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/75">
                Exact-model security
              </span>
            </div>
            <h1 className="display-hero mt-5">
              Security,
              <br />
              <span className="text-[var(--tangerine-dark)]">selected</span>
              <br />
              with care.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-[var(--muted)]">
              Genuine CCTV, networking, storage, and biometric systems—verified by model, priced
              transparently, and supported across Delhi NCR.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="button-primary">
                Shop products <ArrowRight size={17} />
              </Link>
              <Link href="/system-builder" className="button-secondary">
                Build my system
              </Link>
            </div>
            <p className="mt-7 text-sm font-semibold text-[var(--muted)]">
              GST-inclusive pricing · Guest checkout · Documentation by exact model
            </p>
          </div>
          <HeroProducts products={catalogue.slice(0, 8)} />
        </div>
      </section>

      <section className="section-space" data-gsap-reveal>
        <div className="container-standard">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="eyebrow">Start with the space</p>
              <h2 className="display-section mt-4">What needs protecting?</h2>
            </div>
            <p className="max-w-2xl self-end text-lg leading-8 text-[var(--muted)]">
              You should not need to decode camera model names before making a sensible first
              choice. Start with the place, then narrow the hardware.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {requirements.map(([title, copy, requirement, color], index) => (
              <Link
                key={title}
                href={`/system-builder?property=${requirement}`}
                className="group min-h-[250px] rounded-[22px] border border-[var(--line)] p-7 transition-transform hover:-translate-y-1"
                style={{ background: color }}
              >
                <span className="text-xs font-bold text-[var(--muted)]">0{index + 1}</span>
                <h3 className="mt-16 font-display text-3xl font-semibold">{title}</h3>
                <p className="mt-3 max-w-sm leading-7 text-[var(--muted)]">{copy}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold">
                  Build a system{" "}
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        className="section-space border-y border-[var(--line)] bg-[var(--canvas-alt)]"
        data-gsap-reveal
      >
        <div className="container-standard">
          <p className="eyebrow">Shop by category</p>
          <div className="mt-5 flex items-end justify-between gap-4">
            <h2 className="display-section">The useful parts.</h2>
            <Link href="/products" className="button-secondary hidden sm:inline-flex">
              View all
            </Link>
          </div>
          <div className="no-scrollbar mt-10 flex snap-x gap-4 overflow-x-auto pb-3">
            {categories.map((category, index) => {
              const product = catalogue.find((item) => item.categorySlug === category.slug)!;
              return (
                <Link
                  key={category.slug}
                  href={`/categories/${category.slug}`}
                  className="group relative min-h-[390px] min-w-[78vw] snap-start overflow-hidden rounded-[24px] border border-[var(--line)] bg-white sm:min-w-[360px]"
                >
                  <div className="absolute inset-x-0 top-0 h-[62%] bg-[var(--surface)]">
                    <Image
                      src={product.images[0]}
                      alt={`${category.name} example`}
                      fill
                      sizes="360px"
                      className="object-contain p-9 transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-2 font-display text-3xl font-semibold">{category.name}</h3>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold">
                      Explore models <ArrowRight size={16} />
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-space" data-gsap-reveal>
        <div className="container-standard">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="eyebrow">Featured exact models</p>
              <h2 className="display-section mt-4">Ready to compare.</h2>
            </div>
            <Link href="/products" className="button-secondary hidden sm:inline-flex">
              All products
            </Link>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {catalogue.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section
        className="section-space overflow-hidden bg-[var(--ink)] text-white"
        data-gsap-reveal
      >
        <div className="container-standard grid items-center gap-12 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="eyebrow !text-white/55">Guided system builder</p>
            <h2 className="display-section mt-4">
              One system.
              <br />
              No mismatched parts.
            </h2>
            <p className="mt-7 max-w-xl text-lg leading-8 text-white/65">
              Answer a few plain questions about rooms, outdoor zones, recording time and budget.
              The builder returns a compatible starting set—not a random shopping list.
            </p>
            <Link href="/system-builder" className="button-primary mt-8">
              Build my system <ArrowRight size={17} />
            </Link>
          </div>
          <div className="grid gap-3 rounded-[28px] border border-white/15 bg-white/5 p-4 sm:p-7">
            {[
              ["01", "Property and zones"],
              ["02", "Camera count and clarity"],
              ["03", "Night view and audio"],
              ["04", "Recording days and budget"],
            ].map(([number, title]) => (
              <div
                key={number}
                className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.055] p-5"
              >
                <span className="font-display text-2xl font-semibold text-[var(--tangerine)]">
                  {number}
                </span>
                <span className="text-lg font-semibold">{title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space">
        <div className="container-standard">
          <p className="eyebrow">A calmer way to buy</p>
          <div className="mt-10 grid gap-10 lg:grid-cols-3">
            {[
              [
                "Tell us what you need",
                "Start with the space, the risk and the coverage—not a wall of specifications.",
              ],
              [
                "Compare verified products",
                "See exact models, clear documents and prices that already include GST.",
              ],
              [
                "Buy or request help",
                "Order hardware directly or ask for a separate installation assessment.",
              ],
            ].map(([title, copy], index) => (
              <div key={title} className="border-t border-[var(--ink)] pt-6">
                <p className="text-xs font-bold text-[var(--tangerine-dark)]">0{index + 1}</p>
                <h3 className="mt-8 font-display text-4xl font-semibold">{title}</h3>
                <p className="mt-4 max-w-sm leading-7 text-[var(--muted)]">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space border-y border-[var(--line)] bg-[var(--tangerine-soft)]">
        <div className="container-standard">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <h2 className="display-section">Proof without the theatre.</h2>
            <p className="max-w-xl self-end text-lg leading-8 text-[var(--muted)]">
              No invented review counts or artificial urgency. The useful proof is the exact
              product, the invoice, the documentation and a support contact that answers.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [BadgeCheck, "Exact model checks", "Identity and source are recorded by model."],
              [
                IndianRupee,
                "GST-inclusive prices",
                "The displayed selling price is the product total.",
              ],
              [FileText, "Real documents", "Only exact available datasheets and manuals appear."],
              [Wrench, "Installation clarity", "Third-party installation is quoted separately."],
            ].map(([Icon, title, copy]) => {
              const I = Icon as typeof BadgeCheck;
              return (
                <div
                  key={title as string}
                  className="rounded-[20px] border border-[var(--line)] bg-white p-6"
                >
                  <I size={24} />
                  <h3 className="mt-8 font-display text-2xl font-semibold">{title as string}</h3>
                  <p className="mt-3 leading-7 text-[var(--muted)]">{copy as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-space">
        <div className="container-standard">
          <div className="grid items-end gap-8 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Brands and documentation</p>
              <h2 className="display-section mt-4">
                Know the name.
                <br />
                Check the model.
              </h2>
            </div>
            <div className="flex gap-4 lg:justify-end">
              <div className="surface-card px-8 py-6 font-display text-2xl font-bold">CP PLUS</div>
              <div className="surface-card px-8 py-6 font-display text-2xl font-bold text-[#d5222a]">
                eSSL
              </div>
            </div>
          </div>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Where an exact-model datasheet or manual is available, it lives with the product—not
            buried in a generic download folder.
          </p>
        </div>
      </section>

      <section className="section-space border-y border-[var(--line)] bg-[var(--canvas-alt)]">
        <div className="container-reading">
          <p className="eyebrow">Frequently asked</p>
          <h2 className="display-section mt-4">Clear before checkout.</h2>
          <div className="mt-10 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {faq.map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-display text-xl font-semibold">
                  <span>{question}</span>
                  <span className="text-2xl font-normal transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-2 pr-10 leading-7 text-[var(--muted)]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space">
        <div className="container-standard rounded-[28px] bg-[var(--tangerine)] p-8 sm:p-14 lg:p-20">
          <ShieldCheck size={34} />
          <h2 className="mt-10 max-w-4xl font-display text-[clamp(3rem,7vw,7rem)] font-semibold leading-[0.92] tracking-[-0.065em]">
            Not sure which system fits your space?
          </h2>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#3c1d0d]">
            Tell us what you need to protect. We’ll help you choose compatible hardware.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/system-builder"
              className="button-secondary !border-transparent !bg-[var(--ink)] !text-white"
            >
              Build my system
            </Link>
            <Link href="/contact" className="button-secondary !border-[#7b3512]/30 !bg-transparent">
              Talk to a product specialist
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
