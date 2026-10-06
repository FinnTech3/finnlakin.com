import type { ReactNode } from "react";

/* Editorial furniture for the write-ups. These are not body copy, so each sets
   its own size and weight instead of inheriting the long-form setting, and they
   are written against the tokens so they come out right wherever they land: on
   the chalk sheet the essays are set on, or on the wall. */

/* The correction strip. Every one of Finn's READMEs names the wrong turn before
   it names the result, so it gets a designed slot rather than a footnote.

   role="note" rather than <aside>. An aside maps to the complementary landmark,
   and these sit inside <main>, so axe flagged eight nested landmarks across the
   four write-ups. They are editorial devices within the argument rather than
   page-level complementary regions, and note is the role for content that is
   parenthetic to the main flow without being somewhere to navigate to. */
export function WrongFirst({
  struck,
  children,
}: {
  struck: string;
  children: ReactNode;
}) {
  return (
    <div
      role="note"
      className="scored my-12 flex flex-col gap-4 pt-6 sm:flex-row sm:gap-8"
    >
      <p className="t-label shrink-0 self-start">
        <span className="flag">Wrong first</span>
      </p>
      <div className="flex max-w-[62ch] flex-col gap-3 text-[0.9375rem] leading-relaxed">
        <p className="text-muted line-through decoration-carbon decoration-2">{struck}</p>
        <p className="text-ink-soft">{children}</p>
      </div>
    </div>
  );
}

/* A note alongside the argument rather than inside it. */
export function Marginal({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="note" className="my-10 max-w-[58ch] border-l-2 border-carbon pl-6">
      <p className="t-label">{label}</p>
      <div className="mt-2 text-[0.875rem] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

/* A row of figures pulled out of the argument. */
export function Figures({
  items,
}: {
  items: { value: string; label: string; tone?: "pass" | "flag" }[];
}) {
  return (
    <dl className="my-12 grid grid-cols-2 gap-x-8 gap-y-7 border-y-2 border-rule-strong py-7 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1.5">
          <dt className="sr-only">{item.label}</dt>
          <dd className="font-display text-[2.25rem] leading-none font-bold tracking-[-0.01em] uppercase">
            {item.tone === "flag" ? (
              <span className="flag">{item.value}</span>
            ) : (
              <span className={item.tone === "pass" ? "held" : "text-ink"}>{item.value}</span>
            )}
          </dd>
          <p aria-hidden="true" className="t-caption leading-snug text-muted">
            {item.label}
          </p>
        </div>
      ))}
    </dl>
  );
}

/* The real tool, framed, rather than a reimplementation. Rebuilding the
   weighting here would mean inventing the index data, which is the one thing
   this site must not do. Lazy so it costs nothing until it is scrolled to, and
   always paired with a link out, because a frame can be blocked and the piece
   still has to work.

   It keeps a visible frame where nothing else on the site has one. The tool is
   served from another origin and follows the reader's own colour scheme rather
   than this page's, so a ruled edge is what says "this is a different
   document" instead of it looking like a rendering fault. */
export function Embed({
  title,
  src,
  href,
  linkLabel,
  note,
}: {
  title: string;
  src: string;
  href: string;
  linkLabel: string;
  note: string;
}) {
  return (
    <figure className="my-12 flex flex-col gap-4">
      <div className="overflow-hidden border-2 border-carbon">
        <iframe
          title={title}
          src={src}
          loading="lazy"
          className="block h-[32rem] w-full border-0"
        />
      </div>
      <figcaption className="flex flex-col gap-1.5 text-[0.8125rem] leading-relaxed text-muted">
        <span>{note}</span>
        <a
          href={href}
          className="link-arrow self-start underline decoration-2 underline-offset-[3px]"
          target="_blank"
          rel="noopener noreferrer"
        >
          {linkLabel}
        </a>
      </figcaption>
    </figure>
  );
}

export function Limits({ children }: { children: ReactNode }) {
  return (
    <section className="scored my-12 max-w-[64ch] pt-6">
      <h2 className="t-label">What this does not show</h2>
      <div className="mt-4 flex flex-col gap-4 text-[0.875rem] leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}
