import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { writing } from "@/lib/writing";

/* Everything here comes from typed modules compiled into the build, so there
   is no fetch to fail and nothing to cache. A sitemap built from a cached
   fetch is where unstable_cache bites hardest: catch an error inside the
   cached function, return an empty array, and that empty array is stored as a
   success and silently empties the sitemap for the life of the cache entry. */
export default function sitemap(): MetadataRoute.Sitemap {
  /* The index pages carry a real date because it is derivable: publishing a
     write-up is what changes them. The rest carry none at all.

     lastModified used to be new Date(), which is build time, so every deploy
     told crawlers that four pages had changed whether or not anything had.
     A date that is wrong is worth less than no date: the field is optional,
     and omitting it says "unknown", which is true, rather than "today", which
     was not. */
  const newestPiece = writing
    .map((piece) => new Date(piece.published).getTime())
    .reduce((latest, at) => Math.max(latest, at), 0);
  const writingUpdated = newestPiece > 0 ? new Date(newestPiece) : undefined;

  return [
    {
      url: `${siteUrl}/`,
      lastModified: writingUpdated,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteUrl}/writing`,
      lastModified: writingUpdated,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    { url: `${siteUrl}/path`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/cv`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...writing.map((piece) => ({
      url: `${siteUrl}/writing/${piece.slug}`,
      lastModified: new Date(piece.published),
      changeFrequency: "yearly" as const,
      priority: 0.9,
    })),
  ];
}
