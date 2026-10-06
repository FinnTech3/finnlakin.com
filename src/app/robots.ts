import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /* /looks holds the design directions while one is being chosen. They are
         the same content in three different mediums, so indexing them would put
         three near copies of the home page in a search result and none of them
         is the site. Each carries noindex of its own as well; this is the belt
         to that pair of braces. */
      disallow: ["/admin", "/api", "/looks"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
