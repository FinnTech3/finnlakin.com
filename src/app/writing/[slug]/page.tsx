import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleSchema } from "@/components/structured-data";
import { writingBodies } from "@/content/writing";
import { buildMetadata } from "@/lib/metadata";
import { projectBySlug } from "@/lib/projects";
import { writing, writingBySlug } from "@/lib/writing";

export function generateStaticParams() {
  return writing.map((piece) => ({ slug: piece.slug }));
}

/* Without this, dynamicParams defaults to true and an unknown slug cold-starts
   a function, loads the module graph and renders, only to call notFound() at
   the end. The build output said so: the route compiled as "blocking". Every
   bot probing /writing/<anything> was costing a real invocation. False makes
   Next serve the static 404 without entering a render. */
export const dynamicParams = false;

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
  });
}

export default async function WritingPiecePage({ params }: PageProps<"/writing/[slug]">) {
  const { slug } = await params;
  const piece = writingBySlug.get(slug);
  const Body = writingBodies[slug];
  if (!piece || !Body) notFound();

  const project = projectBySlug.get(piece.projectSlug);

  /* Reading order, not reverse-chronological: the pieces build on each other
     and the list in writing.ts is already in the order they should be read. */
  const index = writing.findIndex((entry) => entry.slug === piece.slug);
  const previous = index > 0 ? writing[index - 1] : null;
  const next = index >= 0 && index < writing.length - 1 ? writing[index + 1] : null;

  return (
    <article>
      <ArticleSchema piece={piece} />
      <header className="shell w-full pt-6 pb-16 sm:pt-12 sm:pb-20">
          <div className="t-label flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/writing" className="link-arrow">
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

          <h1 className="t-hlg mt-6 max-w-[8.8em] text-pretty text-ink">
            {piece.title}
          </h1>

          <p className="measure t-body-lg mt-7 text-ink-soft">
            {piece.dek}
          </p>

          {project ? (
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
              {project.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="link-arrow text-[0.875rem]"
                >
                  {link.label} <span aria-hidden="true">&rarr;</span>
                </a>
              ))}
            </div>
          ) : null}
      </header>

      <div className="shell w-full pb-20">
        {/* The piece is read on a sheet of chalk, a poster pasted on the wall.
            Twenty minutes of prose is the one thing on this site that is read
            rather than scanned, and carbon on chalk is 16.8:1 where carbon on
            the wall is 7.5. It is a block with an opaque ground, which is
            allowed here and nowhere on the home page: this route has no cloud
            behind it. */}
        <div className="sheet max-w-[60rem]">
          <div className="longform">
            <Body />
          </div>
        </div>

        {/* Somewhere to go at the end. Without this the only way on from the
            foot of a piece is the back button. */}
        <nav
          aria-label="More writing"
          className="scored mt-14 flex flex-col gap-6 pt-6 print:hidden"
        >
          <div className="grid gap-6 sm:grid-cols-2">
            {previous ? (
              <Link
                href={`/writing/${previous.slug}`}
                className="group flex flex-col gap-1.5 no-underline"
              >
                <span className="t-label">Previous</span>
                <span className="t-h3 max-w-[13.2em] text-ink group-hover:bg-accent-soft">
                  {previous.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/writing/${next.slug}`}
                className="group flex flex-col gap-1.5 no-underline sm:items-end sm:text-right"
              >
                <span className="t-label">Next</span>
                <span className="t-h3 max-w-[13.2em] text-ink group-hover:bg-accent-soft">
                  {next.title}
                </span>
              </Link>
            ) : null}
          </div>

          <Link href="/writing" className="link-arrow t-label self-start text-ink">
            All write-ups
          </Link>
        </nav>
      </div>
    </article>
  );
}
