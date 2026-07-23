import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/products";

/** Category-based background for collection pages */
function categoryAccentBg(categorySlug: string): string {
  if (categorySlug.includes("dome")) return "var(--powder-blue-soft)";
  if (categorySlug.includes("bullet")) return "var(--butter-soft)";
  if (categorySlug.includes("color")) return "var(--coral-soft)";
  if (categorySlug.includes("nvr")) return "var(--lilac-soft)";
  if (categorySlug.includes("biometric")) return "var(--mint-soft)";
  if (categorySlug.includes("poe") || categorySlug.includes("switch")) return "var(--technical-grey)";
  return "var(--canvas)";
}

export function CollectionPage({
  eyebrow,
  title,
  description,
  products,
  accentBg,
  categorySlug,
}: {
  eyebrow: string;
  title: string;
  description: string;
  products: Product[];
  accentBg?: string;
  categorySlug?: string;
}) {
  const bg = accentBg ?? (categorySlug ? categoryAccentBg(categorySlug) : "var(--canvas)");
  return (
    <div style={{ background: bg }}>
      <div className="container-standard section-space !pt-14">
        <div className="max-w-2xl mb-10">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-section mt-3">{title}</h1>
          <p className="mt-4 text-base leading-7 text-[var(--ink-soft)]">{description}</p>
          <Link href="/products" className="button-secondary mt-5">
            Browse all products <ArrowRight size={16} />
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
