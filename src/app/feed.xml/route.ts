import { siteDescription, siteTitle, siteUrl, contact } from "@/lib/site";
import { writing } from "@/lib/writing";

/* Static, for the same reason the sitemap is: everything here comes from typed
   modules compiled into the build, so there is no fetch to fail and nothing to
   cache. Atom rather than RSS because it requires an unambiguous id and a real
   updated timestamp per entry, both of which this content has. */
export const dynamic = "force-static";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function GET(): Response {
  /* Reverse chronological for a feed reader, which is the opposite of the
     reading order the site presents them in. */
  const entries = [...writing].sort(
    (a, b) => Date.parse(b.published) - Date.parse(a.published),
  );

  const updated = new Date(
    entries.length > 0 ? Date.parse(entries[0]!.published) : Date.now(),
  ).toISOString();

  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(siteTitle)}</title>
  <subtitle>${escapeXml(siteDescription)}</subtitle>
  <link href="${siteUrl}/feed.xml" rel="self"/>
  <link href="${siteUrl}/writing"/>
  <id>${siteUrl}/</id>
  <updated>${updated}</updated>
  <author>
    <name>${escapeXml(siteTitle)}</name>
    <email>${escapeXml(contact.email)}</email>
  </author>
${entries
  .map((piece) => {
    const url = `${siteUrl}/writing/${piece.slug}`;
    return `  <entry>
    <title>${escapeXml(piece.title)}</title>
    <link href="${url}"/>
    <id>${url}</id>
    <updated>${new Date(piece.published).toISOString()}</updated>
    <summary>${escapeXml(piece.dek)}</summary>
  </entry>`;
  })
  .join("\n")}
</feed>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
