import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedCatalogue } from "@/data/catalogue-cache";
import { deriveBrands, toPublicProducts } from "@/lib/catalogue-view";
import { CollectionPage } from "@/components/collection-page";

// Request-time rendered so a newly published brand resolves without a redeploy.
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const { products } = await getCachedCatalogue();
  const brand = deriveBrands(products).find((item) => item.slug === slug);
  return brand
    ? {
        title: `${brand.name} products`,
        description: `Browse ${brand.name} products by exact model.`,
        alternates: { canonical: `/brands/${slug}` },
      }
    : {};
}

export default async function BrandPage({ params }: { params: Params }) {
  const { slug } = await params;
  const snapshot = await getCachedCatalogue();
  const brand = deriveBrands(snapshot.products).find((item) => item.slug === slug);
  // A brand exists only if the canonical catalogue has products under it.
  if (!brand) notFound();
  const products = snapshot.products.filter((product) => product.brandSlug === slug);

  return (
    <CollectionPage
      eyebrow="Shop by brand"
      title={brand.name}
      description={`Exact-model ${brand.name} hardware with clear specifications, available documentation and GST-inclusive pricing.`}
      products={toPublicProducts(products)}
      accentBg="var(--background)"
      degraded={snapshot.authority === "static_degraded"}
    />
  );
}
