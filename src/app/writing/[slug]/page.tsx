import Link from "next/link";
import { notFound } from "next/navigation";
import { writingBodies } from "@/content/writing";
import { buildMetadata } from "@/lib/metadata";
import { projectBySlug } from "@/lib/projects";
import { writing, writingBySlug } from "@/lib/writing";

export function generateStaticParams() {
  return writing.map((piece) => ({ slug: piece.slug }));
}

/* The title comes from params, so this has to be generateMetadata rather than
   an exported metadata object. The route still prerenders: generateStaticParams
   supplies every slug at build. */
export async function generateMetadata({ params }: PageProps<"/writing/[slug]">) {
  const { slug } = await params;
  const piece = writingBySlug.get(slug);
  if (!piece) return buildMetadata({ path: `/writing/${slug}`, noindex: true });

  return buildMetadata({
    path: `/writing/${piece.slug}`,
    title: piece.title,
    description: piece.dek,
    type: "article",
    kicker: piece.kicker,
  });
}

export default async function WritingPiecePage({ params }: PageProps<"/writing/[slug]">) {
  const { slug } = await params;
  const piece = writingBySlug.get(slug);
  const Body = writingBodies[slug];
  if (!piece || !Body) notFound();

  const project = projectBySlug.get(piece.projectSlug);

  return (
    <article>
      <header className="border-b border-rule">
        <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            <Link href="/writing" className="text-accent hover:underline">
              Writing
            </Link>
            <span aria-hidden="true">·</span>
            <time dateTime={piece.published}>
              {new Date(piece.published).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </div>

          <h1 className="mt-5 max-w-[20ch] text-pretty font-serif text-[clamp(2rem,6vw,3.4rem)] leading-[1.06] tracking-[-0.025em]">
            {piece.title}
          </h1>

          <p className="mt-5 max-w-[62ch] text-[clamp(1rem,2.2vw,1.15rem)] leading-relaxed text-muted">
            {piece.dek}
          </p>

          {project ? (
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
              {project.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="border-b border-rule-strong pb-0.5 font-mono text-[12px] text-accent hover:border-accent"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-16">
        <div className="longform">
          <Body />
        </div>
      </div>
    </article>
  );
}
