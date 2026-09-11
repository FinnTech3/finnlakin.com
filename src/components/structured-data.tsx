import { projects } from "@/lib/projects";
import { contact, person, siteDescription, siteUrl } from "@/lib/site";
import type { WritingPiece } from "@/lib/writing";

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      /* Serialised here rather than interpolated into markup: the content is
         our own typed modules, and JSON.stringify escapes nothing dangerous
         into a script context on its own, so < is replaced explicitly. */
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function PersonSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Person",
        name: person.name,
        description: siteDescription,
        url: siteUrl,
        email: `mailto:${contact.email}`,
        address: { "@type": "PostalAddress", addressLocality: "Oxford", addressCountry: "GB" },
        alumniOf: [
          { "@type": "CollegeOrUniversity", name: person.university },
          { "@type": "CollegeOrUniversity", name: person.exchange },
        ],
        knowsLanguage: ["en", "fr", "es"],
        sameAs: [contact.linkedin, contact.github],
        subjectOf: projects.slice(0, 5).map((project) => ({
          "@type": "SoftwareSourceCode",
          name: project.name,
          codeRepository: project.links[0]?.href,
        })),
      }}
    />
  );
}

export function ArticleSchema({ piece }: { piece: WritingPiece }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: piece.title,
        description: piece.dek,
        datePublished: piece.published,
        dateModified: piece.published,
        url: `${siteUrl}/writing/${piece.slug}`,
        mainEntityOfPage: `${siteUrl}/writing/${piece.slug}`,
        author: { "@type": "Person", name: person.name, url: siteUrl },
        publisher: { "@type": "Person", name: person.name, url: siteUrl },
      }}
    />
  );
}
