import type { CSSProperties } from "react";
import { ClipPlayer } from "@/components/clip";
import type { Product } from "@/lib/software";

/* One product, and everything a reader needs in order to decide: what it is, one
   number it stands on, what it will not do, and where to get it.

   The picture comes first on a wide card and the words after it, so a reader
   sees the thing working before reading about it. Below that it is one column,
   in the same order.

   Where there is a live listing the primary link goes to it. Where there is not,
   which is true of every product until a listing exists, the card says so and the
   primary link is the source. A link to a page that has not been checked is the
   one thing this component will not render, and a button that says buy over a
   repository would be a promise it cannot keep. */
/* Where it can be had, in a few words. Only a skill is sold on Agensi, so only a
   skill is ever said to be coming there. */
function status(product: Product): string {
  if (product.kind === "app") return "Download on GitHub";
  return product.agensi ? "On Agensi" : "Agensi listing coming";
}

export function SoftwareCard({ product, index }: { product: Product; index: number }) {
  const ordinal = String(index + 1).padStart(2, "0");
  const { media } = product;
  const aspect = { aspectRatio: `${media.width} / ${media.height}` } as CSSProperties;

  return (
    <article id={product.slug} className="@container scored pt-8 pb-20">
      <div data-reveal="">
        <p className="t-label flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="tnum text-tone">{ordinal}</span>
          <span>{product.kind === "skill" ? "Agent skill" : "Desktop app"}</span>
          <span className="text-ink">{status(product)}</span>
        </p>
        <h2 className="t-hsm mt-4 max-w-[12em] text-ink text-balance">{product.name}</h2>
      </div>

      <div className="mt-8 grid items-start gap-x-12 gap-y-10 @4xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <figure data-reveal="" className="m-0">
          <div
            style={aspect}
            className="relative w-full overflow-hidden rounded-[var(--radius-lg)] border border-glass-edge"
          >
            {media.kind === "clip" ? (
              <ClipPlayer clip={media.clip} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- a 10 KB still, sized by the box above
              <img
                src={media.src}
                alt={media.alt}
                width={media.width}
                height={media.height}
                loading="lazy"
                decoding="async"
                className="block h-full w-full object-cover"
              />
            )}
          </div>
          <figcaption className="t-caption mt-3 max-w-[60ch] leading-relaxed text-muted">
            {media.kind === "clip" ? media.clip.caption : media.caption}
          </figcaption>
        </figure>

        <div className="flex flex-col gap-8">
          <p data-reveal="" className="lede max-w-[26em]">
            {product.promise}
          </p>

          <div data-reveal="" className="stat">
            <p className="stat-value text-ink">{product.proof.value}</p>
            <p className="stat-label max-w-[34ch]">{product.proof.label}</p>
          </div>

          <p data-reveal="" className="measure t-caption leading-relaxed text-muted">
            <span className="font-bold text-ink">Needs.{" "}</span>
            {product.needs}
          </p>

          <blockquote data-reveal="" className="m-0 border-l-2 border-tone pl-6">
            <p className="t-label text-ink">What it will not do</p>
            <p className="mt-3 max-w-[34em] font-serif text-[clamp(1.1rem,1.6vw,1.3rem)] leading-[1.45] text-ink-soft italic">
              {product.limit}
            </p>
          </blockquote>

          <div data-reveal="" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {product.agensi ? (
                <a href={product.agensi} rel="noopener" className="pill pill-ghost">
                  Get it on Agensi
                </a>
              ) : product.download ? (
                <a href={product.download} rel="noopener" className="pill pill-ghost">
                  Download from GitHub Releases
                </a>
              ) : (
                <a href={product.github} rel="noopener" className="pill pill-ghost">
                  On GitHub
                </a>
              )}
              {product.agensi || product.download ? (
                <a href={product.github} rel="noopener" className="link-arrow text-[0.9375rem]">
                  Source on GitHub <span aria-hidden="true">&rarr;</span>
                </a>
              ) : (
                <span className="t-label">{status(product)}</span>
              )}
            </div>
            {product.note ? (
              <p className="measure t-caption leading-relaxed text-muted">{product.note}</p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
