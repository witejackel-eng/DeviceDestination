import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brands, catalogue } from "@/data/catalog";
import { CollectionPage } from "@/components/collection-page";

type Params = Promise<{ slug: string }>;
export function generateStaticParams() {
  return brands.map((brand) => ({ slug: brand.slug }));
}
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const brand = brands.find((item) => item.slug === slug);
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
  const brand = brands.find((item) => item.slug === slug);
  if (!brand) notFound();
  const products = catalogue.filter((product) => product.brandSlug === slug);
  return (
    <CollectionPage
      eyebrow="Shop by brand"
      title={brand.name}
      description={`Exact-model ${brand.name} hardware with clear specifications, available documentation and GST-inclusive pricing.`}
      products={products}
      accentBg="var(--background)"
    />
  );
}
