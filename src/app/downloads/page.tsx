import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { catalogue } from "@/data/catalog";
import { publicPageMetadata } from "@/lib/seo";
export const metadata: Metadata = publicPageMetadata({
  title: "Product downloads",
  description: "Exact-model datasheets and manuals for DeviceDestination products.",
  path: "/downloads",
});
export default function DownloadsPage() {
  const available = catalogue.filter((product) => product.documents.length > 0);
  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Technical library</p>
      <h1 className="display-section mt-4">Documents by exact model.</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-muted)]">
        Buttons appear only where the local file is matched to the published product model.
      </p>
      <div className="mt-10 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {available.map((product) => (
          <div key={product.id} className="grid gap-5 py-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-bold text-[var(--text-muted)]">{product.brand}</p>
              <Link
                href={`/products/${product.slug}`}
                className="mt-1 block font-display text-2xl font-semibold hover:underline"
              >
                {product.model}
              </Link>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{product.title}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              {product.documents.map((document) => (
                <a
                  key={document.url}
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button-secondary"
                >
                  <Download size={16} /> {document.title}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
