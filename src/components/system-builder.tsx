"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { catalogue } from "@/data/catalog";
import { formatPrice } from "@/lib/products";
import { useCartStore } from "@/lib/cart-store";

type Answers = {
  property: string;
  outdoor: boolean;
  cameras: number;
  resolution: "2MP" | "4MP";
  night: "IR" | "Colour";
  days: number;
  audio: boolean;
  installation: boolean;
  budget: string;
};
const initial: Answers = {
  property: "Home",
  outdoor: true,
  cameras: 4,
  resolution: "4MP",
  night: "IR",
  days: 15,
  audio: true,
  installation: true,
  budget: "₹20,000–₹40,000",
};

export function SystemBuilder() {
  const [answers, setAnswers] = useState(initial);
  const addItem = useCartStore((state) => state.addItem);
  const recommendation = useMemo(() => {
    const wants4 = answers.resolution === "4MP";
    const wantsColour = answers.night === "Colour";
    const camera =
      catalogue.find((product) => {
        const model = product.model;
        const correctResolution = wants4 ? model.includes("41L3") : model.includes("21L3");
        const correctNight = wantsColour ? model.includes("LQ") : model.endsWith("Q");
        const correctShape = answers.outdoor
          ? product.category.includes("Bullet")
          : product.category.includes("Dome");
        return correctResolution && correctNight && correctShape;
      }) ?? catalogue[0];
    const nvr = catalogue.find(
      (product) => product.model === (answers.cameras <= 8 ? "CP-UNR-108F1" : "CP-UNR-4K2161-V2"),
    );
    const hardwareTotal =
      (camera.sellingPriceInclGstPaise ?? 0) * answers.cameras +
      (nvr?.sellingPriceInclGstPaise ?? 0);
    return { camera, nvr, hardwareTotal };
  }, [answers]);

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers((current) => ({ ...current, [key]: value }));
  const addSet = () => {
    addItem(recommendation.camera.id, answers.cameras);
    if (recommendation.nvr) addItem(recommendation.nvr.id);
  };
  const fieldClass = "h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3";

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <form
        className="surface-card grid gap-6 p-6 sm:p-8"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">
            Property type
            <select
              className={fieldClass}
              value={answers.property}
              onChange={(event) => set("property", event.target.value)}
            >
              {["Home", "Retail shop", "Office", "Warehouse", "School", "Apartment society"].map(
                (item) => (
                  <option key={item}>{item}</option>
                ),
              )}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Camera zones
            <select
              className={fieldClass}
              value={answers.outdoor ? "outdoor" : "indoor"}
              onChange={(event) => set("outdoor", event.target.value === "outdoor")}
            >
              <option value="indoor">Mostly indoor</option>
              <option value="outdoor">Includes outdoor</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Number of cameras
            <input
              type="number"
              min={1}
              max={16}
              className={fieldClass}
              value={answers.cameras}
              onChange={(event) =>
                set("cameras", Math.min(16, Math.max(1, Number(event.target.value))))
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Resolution
            <select
              className={fieldClass}
              value={answers.resolution}
              onChange={(event) => set("resolution", event.target.value as Answers["resolution"])}
            >
              <option>2MP</option>
              <option>4MP</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Night view
            <select
              className={fieldClass}
              value={answers.night}
              onChange={(event) => set("night", event.target.value as Answers["night"])}
            >
              <option>IR</option>
              <option>Colour</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Recording days
            <input
              type="number"
              min={1}
              max={90}
              className={fieldClass}
              value={answers.days}
              onChange={(event) => set("days", Math.max(1, Number(event.target.value)))}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Audio
            <select
              className={fieldClass}
              value={answers.audio ? "yes" : "no"}
              onChange={(event) => set("audio", event.target.value === "yes")}
            >
              <option value="yes">Built-in audio preferred</option>
              <option value="no">Audio not required</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Budget
            <select
              className={fieldClass}
              value={answers.budget}
              onChange={(event) => set("budget", event.target.value)}
            >
              {["Under ₹20,000", "₹20,000–₹40,000", "₹40,000–₹75,000", "₹75,000+"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex min-h-12 items-center gap-3 rounded-xl bg-[var(--canvas-alt)] px-4 text-sm font-bold">
          <input
            type="checkbox"
            checked={answers.installation}
            onChange={(event) => set("installation", event.target.checked)}
            className="h-5 w-5 accent-[var(--tangerine)]"
          />{" "}
          Request third-party installation help
        </label>
      </form>
      <section className="rounded-[26px] bg-[var(--ink)] p-6 text-white sm:p-9" aria-live="polite">
        <p className="eyebrow !text-white/55">Compatible starting set</p>
        <h2 className="mt-4 font-display text-4xl font-semibold">
          Built for {answers.cameras} cameras.
        </h2>
        <div className="mt-8 grid gap-3">
          {[recommendation.camera, recommendation.nvr].filter(Boolean).map(
            (product, index) =>
              product && (
                <div
                  key={product.id}
                  className="grid grid-cols-[76px_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-3"
                >
                  <div className="relative aspect-square rounded-xl bg-white">
                    <Image
                      src={product.images[0]}
                      alt=""
                      fill
                      sizes="76px"
                      className="object-contain p-2"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-white/55">
                      {index === 0 ? `${answers.cameras} × camera` : "1 × recorder"}
                    </p>
                    <Link href={`/products/${product.slug}`} className="font-bold hover:underline">
                      {product.model}
                    </Link>
                  </div>
                  <p className="text-sm font-bold">
                    {formatPrice(
                      (product.sellingPriceInclGstPaise ?? 0) * (index === 0 ? answers.cameras : 1),
                    )}
                  </p>
                </div>
              ),
          )}
        </div>
        <div className="mt-5 grid gap-2 rounded-2xl border border-white/10 p-5 text-sm text-white/70">
          <p className="flex gap-2">
            <CheckCircle2 size={17} className="text-[var(--tangerine)]" /> Channel count fits the
            recommended recorder.
          </p>
          <p className="flex gap-2">
            <CheckCircle2 size={17} className="text-[var(--tangerine)]" /> {answers.night}{" "}
            night-view preference applied.
          </p>
          <p className="flex gap-2">
            <CheckCircle2 size={17} className="text-[var(--tangerine)]" /> Storage for{" "}
            {answers.days} days requires scene/activity sizing before purchase.
          </p>
          <p className="flex gap-2">
            <CheckCircle2 size={17} className="text-[var(--tangerine)]" /> PoE switching, HDD and
            cabling are quoted after route and distance checks.
          </p>
        </div>
        <div className="mt-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/55">Camera + NVR estimate</p>
            <p className="font-display text-4xl font-bold">
              {formatPrice(recommendation.hardwareTotal)}
            </p>
            <p className="text-xs text-white/50">
              GST included · HDD, PoE, cable and installation separate
            </p>
          </div>
        </div>
        <button type="button" onClick={addSet} className="button-primary mt-6 w-full">
          Add compatible core set to cart
        </button>
        <Link
          href="/quote"
          className="button-secondary mt-3 w-full !border-white/20 !bg-white/10 !text-white"
        >
          Request complete system quote
        </Link>
      </section>
    </div>
  );
}
