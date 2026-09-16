import type { ReactNode } from "react";

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
      className="my-10 flex flex-col gap-3 border-t border-rule pt-5 sm:flex-row sm:gap-5"
    >
      <p className="shrink-0 self-start rounded-xs border border-flag px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-flag">
        Wrong first
      </p>
      <div className="flex max-w-[62ch] flex-col gap-2 font-sans text-[15px] leading-relaxed">
        <p className="text-muted line-through decoration-flag">{struck}</p>
        <p className="text-ink-soft">{children}</p>
      </div>
    </div>
  );
}

/* A note alongside the argument rather than inside it. */
export function Marginal({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="note" className="my-8 max-w-[58ch] border-l-2 border-accent pl-4 font-sans">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
        {label}
      </p>
      <div className="mt-1.5 text-sm leading-relaxed text-muted">{children}</div>
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
    <dl className="my-10 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-rule py-5 font-sans sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <dt className="sr-only">{item.label}</dt>
          <dd
            className={`font-mono text-[1.35rem] leading-none font-medium tabular-nums tracking-[-0.02em] ${
              item.tone === "pass" ? "text-pass" : item.tone === "flag" ? "text-flag" : "text-ink"
            }`}
          >
            {item.value}
          </dd>
          <p aria-hidden="true" className="text-xs leading-snug text-muted">
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
   still has to work. */
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
    <figure className="my-10 flex flex-col gap-3 font-sans">
      <div className="overflow-hidden border border-rule bg-panel">
        <iframe
          title={title}
          src={src}
          loading="lazy"
          className="block h-[32rem] w-full border-0"
        />
      </div>
      <figcaption className="flex flex-col gap-1 text-[13px] leading-relaxed text-muted">
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
    <section className="my-10 max-w-[64ch] border-t border-rule-strong pt-5 font-sans">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.13em] text-ink">
        What this does not show
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}
