import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/products";

export function CollectionPage({
  eyebrow,
  title,
  description,
  products,
}: {
  eyebrow: string;
  title: string;
  description: string;
  products: Product[];
}) {
  return (
    <div className="container-standard section-space !pt-14">
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-section mt-4">{title}</h1>
        </div>
        <div className="self-end">
          <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">{description}</p>
          <Link href="/products" className="button-secondary mt-6">
            Browse all products
          </Link>
        </div>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
