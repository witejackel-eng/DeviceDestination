import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/products";

export function CollectionPage({
  eyebrow,
  title,
  description,
  products,
  accentBg,
}: {
  eyebrow: string;
  title: string;
  description: string;
  products: Product[];
  accentBg?: string;
}) {
  return (
    <div style={accentBg ? { background: accentBg } : { background: "var(--canvas)" }}>
      <div className="container-standard section-space !pt-14">
        <div className="max-w-2xl mb-10">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-section mt-3">{title}</h1>
          <p className="mt-4 text-base leading-7 text-[var(--ink-soft)]">{description}</p>
          <Link href="/products" className="button-secondary mt-5">
            Browse all products
          </Link>
        </div>
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
