import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { catalogue, categories } from "@/data/catalog";
import { CollectionPage } from "@/components/collection-page";

type Params = Promise<{ slug: string }>;
export function generateStaticParams() {
  return categories.map((category) => ({ slug: category.slug }));
}
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const category = categories.find((item) => item.slug === slug);
  return category
    ? {
        title: category.name,
        description: `Browse ${category.name} by exact model.`,
        alternates: { canonical: `/categories/${slug}` },
      }
    : {};
}
export default async function CategoryPage({ params }: { params: Params }) {
  const { slug } = await params;
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();
  const products = catalogue.filter((product) => product.categorySlug === slug);
  return (
    <CollectionPage
      eyebrow="Shop by category"
      title={category.name}
      description={`Compare ${category.name.toLowerCase()} by exact model, documented specifications and GST-inclusive price.`}
      products={products}
    />
  );
}
