import type { Metadata } from "next";
import { cardPathForPage } from "./share-cards";
import { siteDescription, siteTitle, siteUrl } from "./site";

type BuildMetadataOptions = {
  /* Absolute path, leading slash, no trailing slash except at the root. */
  path: string;
  title?: string;
  description?: string;
  type?: "website" | "article";
  noindex?: boolean;
};

/* The card is addressed by page, not by text. See src/lib/share-cards.ts for
   why the endpoint no longer takes a title. */
export function ogImageUrl(path: string): string {
  return cardPathForPage(path);
}

/* Next merges metadata per key, not per field. A page declaring a partial
   openGraph replaces the inherited object wholesale and silently loses the
   site name, url and image; declaring alternates the same way drops the
   canonical. So this always returns every key complete, and pages call it
   instead of hand-writing metadata. */
export function buildMetadata({
  path,
  title,
  description = siteDescription,
  type = "website",
  noindex = false,
}: BuildMetadataOptions): Metadata {
  const canonical = `${siteUrl}${path === "/" ? "" : path}`;
  const fullTitle = title ? `${title} · ${siteTitle}` : siteTitle;
  const cardTitle = title ?? siteTitle;
  const image = ogImageUrl(path);

  return {
    title: title ?? { absolute: siteTitle },
    description,
    alternates: {
      canonical,
      /* Declared on every page, not just /writing, so a reader who subscribes
         from wherever they landed finds it. */
      types: { "application/atom+xml": `${siteUrl}/feed.xml` },
    },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type,
      siteName: siteTitle,
      title: fullTitle,
      description,
      url: canonical,
      images: [{ url: image, width: 1200, height: 630, alt: cardTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
  };
}
