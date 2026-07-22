import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { catalogue } from "@/data/catalog";
import { formatPrice } from "@/lib/products";
import { AddToCart } from "@/components/add-to-cart";

export const metadata: Metadata = {
  title: "Compare products",
  robots: { index: false, follow: true },
};
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ids = typeof params.ids === "string" ? params.ids.split(",").slice(0, 4) : [];
  const selected = ids.length
    ? catalogue.filter((product) => ids.includes(product.id))
    : catalogue.slice(0, 3);
  const specLabels = Array.from(
    new Set(selected.flatMap((product) => Object.keys(product.specs))),
  ).slice(0, 18);
  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Side-by-side</p>
      <h1 className="display-section mt-4">Compare exact models.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
        This page uses the selected public catalogue facts. Confirm full-system compatibility before
        ordering.
      </p>
      <div className="mt-10 overflow-x-auto rounded-[22px] border border-[var(--line)] bg-white">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr>
              <th className="w-[220px] bg-[var(--canvas-alt)] p-5">Product</th>
              {selected.map((product) => (
                <th
                  key={product.id}
                  className="min-w-[240px] border-l border-[var(--line)] p-5 align-top"
                >
                  <div className="relative mb-4 aspect-[1.3] rounded-2xl bg-[var(--canvas-alt)]">
                    <Image
                      src={product.images[0]}
                      alt=""
                      fill
                      sizes="240px"
                      className="object-contain p-3"
                    />
                  </div>
                  <p className="text-xs font-bold text-[var(--muted)]">{product.model}</p>
                  <Link
                    href={`/products/${product.slug}`}
                    className="mt-1 block font-display text-xl font-semibold hover:underline"
                  >
                    {product.title}
                  </Link>
                  <p className="mt-3 text-xl font-bold">
                    {formatPrice(product.sellingPriceInclGstPaise)}
                  </p>
                  <AddToCart productId={product.id} className="button-primary mt-3 w-full" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specLabels.map((label) => (
              <tr key={label} className="border-t border-[var(--line)]">
                <th className="bg-[var(--canvas-alt)] p-5 text-sm">{label}</th>
                {selected.map((product) => (
                  <td
                    key={product.id}
                    className="border-l border-[var(--line)] p-5 text-sm leading-6 text-[var(--muted)]"
                  >
                    {product.specs[label] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
