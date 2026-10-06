import Link from "next/link";
import { Section } from "@/components/section";
import { buildMetadata } from "@/lib/metadata";
import { writing } from "@/lib/writing";

export const metadata = buildMetadata({
  path: "/writing",
  title: "Writing",
  description:
    "Long-form write-ups of the projects, each one built around a single finding and the argument for why it holds.",
});

export default function WritingIndexPage() {
  return (
    <Section
      id="writing"
      level={1}
      eyebrow="Writing"
      title="Long-form"
      intro="One piece per finding, with the argument set out properly rather than compressed into a card. Each states what it does not show."
    >
      <ul className="flex flex-col">
        {writing.map((piece) => (
          <li key={piece.slug} className="row-hover scored-thin py-10 first:pt-6">
            <article className="flex flex-col gap-4">
              <time
                dateTime={piece.published}
                className="t-label"
              >
                {new Date(piece.published).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
              {/* h2, not h3. The Section heading above is the h1 on this page,
                  so an h3 here skipped a level. axe rates heading-order as
                  moderate and the gate only fails on serious and critical,
                  which is why it shipped. */}
              <h2 className="t-hsm max-w-[9.5em] text-pretty text-ink">
                <Link href={`/writing/${piece.slug}`} className="hover:bg-accent-soft">
                  {piece.title}
                </Link>
              </h2>
              <p className="measure text-[0.9375rem] leading-relaxed text-ink-soft">
                {piece.dek}
              </p>
            </article>
          </li>
        ))}
      </ul>
    </Section>
  );
}
