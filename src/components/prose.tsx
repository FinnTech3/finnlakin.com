import type { ReactNode } from "react";

/* These used to say font-sans on every block, because the long-form body was a
   serif and they had to opt out of it. There is one typeface now, so the
   override is gone. What they still do is set their own weight: .longform runs
   at 300 and these are editorial furniture rather than body copy. */

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
      className="my-12 flex flex-col gap-4 border-t border-rule pt-6 sm:flex-row sm:gap-8"
    >
      <p className="t-caption shrink-0 self-start rounded-full border border-flag px-3 py-1 uppercase tracking-[0.12em] text-flag">
        Wrong first
      </p>
      <div className="flex max-w-[62ch] flex-col gap-3 text-[16px] leading-relaxed font-light">
        <p className="text-muted line-through decoration-flag">{struck}</p>
        <p className="text-ink-soft">{children}</p>
      </div>
    </div>
  );
}

/* A note alongside the argument rather than inside it. */
export function Marginal({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="note" className="my-10 max-w-[58ch] border-l-2 border-action pl-6">
      <p className="t-caption uppercase tracking-[0.12em] text-spark">{label}</p>
      <div className="mt-2 text-[15px] leading-relaxed font-light text-muted">{children}</div>
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
    <dl className="my-12 grid grid-cols-2 gap-x-8 gap-y-7 border-y border-rule py-7 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1.5">
          <dt className="sr-only">{item.label}</dt>
          <dd
            className={`tnum text-[1.6rem] leading-none tracking-[-0.03em] ${
              item.tone === "pass" ? "text-pass" : item.tone === "flag" ? "text-flag" : "text-ink"
            }`}
          >
            {item.value}
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
   than this page's, so a hairline is what says "this is a different document"
   instead of it looking like a rendering fault. */
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
      <div className="overflow-hidden rounded-xl border border-rule-strong">
        <iframe
          title={title}
          src={src}
          loading="lazy"
          className="block h-[32rem] w-full border-0"
        />
      </div>
      <figcaption className="flex flex-col gap-1.5 text-[14px] leading-relaxed font-light text-muted">
        <span>{note}</span>
        <a
          href={href}
          className="text-accent underline underline-offset-[3px]"
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
    <section className="my-12 max-w-[64ch] border-t border-rule-strong pt-6">
      <h2 className="t-label text-spark">What this does not show</h2>
      <div className="mt-4 flex flex-col gap-4 text-[15px] leading-relaxed font-light text-muted">
        {children}
      </div>
    </section>
  );
}
