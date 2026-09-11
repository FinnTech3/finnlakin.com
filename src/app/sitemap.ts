import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { writing } from "@/lib/writing";

/* Everything here comes from typed modules compiled into the build, so there
   is no fetch to fail and nothing to cache. A sitemap built from a cached
   fetch is where unstable_cache bites hardest: catch an error inside the
   cached function, return an empty array, and that empty array is stored as a
   success and silently empties the sitemap for the life of the cache entry. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/writing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/cv`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    ...writing.map((piece) => ({
      url: `${siteUrl}/writing/${piece.slug}`,
      lastModified: new Date(piece.published),
      changeFrequency: "yearly" as const,
      priority: 0.9,
    })),
  ];
}
