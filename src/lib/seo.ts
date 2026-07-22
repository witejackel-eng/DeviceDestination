import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

export function publicPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    robots: input.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: input.title,
      description: input.description,
      url: new URL(input.path, siteConfig.url).toString(),
      siteName: siteConfig.name,
      locale: "en_IN",
      type: "website",
    },
  };
}
