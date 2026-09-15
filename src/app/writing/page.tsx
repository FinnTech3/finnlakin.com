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
          <li key={piece.slug} className="border-t border-rule py-7 first:border-t-0 first:pt-0">
            <article className="flex flex-col gap-3">
              <time
                dateTime={piece.published}
                className="font-mono text-[11px] uppercase tracking-[0.11em] text-muted"
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
              <h2 className="max-w-[24ch] text-pretty font-serif text-[clamp(1.5rem,4vw,2rem)] leading-[1.12] tracking-[-0.018em]">
                <Link href={`/writing/${piece.slug}`} className="hover:text-accent">
                  {piece.title}
                </Link>
              </h2>
              <p className="max-w-[64ch] text-[15px] leading-relaxed text-muted">
                {piece.dek}
              </p>
            </article>
          </li>
        ))}
      </ul>
    </Section>
  );
}
