import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedCatalogue } from "@/data/catalogue-cache";
import { deriveCategories, toPublicProducts } from "@/lib/catalogue-view";
import { CollectionPage } from "@/components/collection-page";

// Request-time rendered so a newly published category resolves without a
// redeploy. The catalogue behind it is still cached across requests.
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const { products } = await getCachedCatalogue();
  const category = deriveCategories(products).find((item) => item.slug === slug);
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
  const snapshot = await getCachedCatalogue();
  const category = deriveCategories(snapshot.products).find((item) => item.slug === slug);
  // A category exists only if the canonical catalogue has products in it, so an
  // emptied database gives 404 rather than a page of resurrected static products.
  if (!category) notFound();
  const products = snapshot.products.filter((product) => product.categorySlug === slug);

  return (
    <CollectionPage
      eyebrow="Shop by category"
      title={category.name}
      description={`Compare ${category.name.toLowerCase()} by exact model, documented specifications and GST-inclusive price.`}
      products={toPublicProducts(products)}
      categorySlug={slug}
      degraded={snapshot.authority === "static_degraded"}
    />
  );
}
