import type { Metadata } from "next";
import { siteDescription, siteTitle, siteUrl } from "./site";

type BuildMetadataOptions = {
  /* Absolute path, leading slash, no trailing slash except at the root. */
  path: string;
  title?: string;
  description?: string;
  type?: "website" | "article";
  /* Small label printed above the title on the share card. */
  kicker?: string;
  noindex?: boolean;
};

export function ogImageUrl(title: string, kicker?: string): string {
  const params = new URLSearchParams({ title });
  if (kicker) params.set("kicker", kicker);
  return `/api/og?${params.toString()}`;
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
  kicker,
  noindex = false,
}: BuildMetadataOptions): Metadata {
  const canonical = `${siteUrl}${path === "/" ? "" : path}`;
  const fullTitle = title ? `${title} · ${siteTitle}` : siteTitle;
  const cardTitle = title ?? siteTitle;
  const image = ogImageUrl(cardTitle, kicker);

  return {
    title: title ?? { absolute: siteTitle },
    description,
    alternates: { canonical },
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
