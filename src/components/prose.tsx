import type { ReactNode } from "react";

/* The correction strip. Every one of Finn's READMEs names the wrong turn before
   it names the result, so it gets a designed slot rather than a footnote. */
export function WrongFirst({
  struck,
  children,
}: {
  struck: string;
  children: ReactNode;
}) {
  return (
    <aside className="my-10 flex flex-col gap-3 border-t border-rule pt-5 sm:flex-row sm:gap-5">
      <p className="shrink-0 self-start rounded-xs border border-flag px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-flag">
        Wrong first
      </p>
      <div className="flex max-w-[62ch] flex-col gap-2 font-sans text-[15px] leading-relaxed">
        <p className="text-muted line-through decoration-flag">{struck}</p>
        <p className="text-ink-soft">{children}</p>
      </div>
    </aside>
  );
}

/* A note alongside the argument rather than inside it. */
export function Marginal({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside className="my-8 max-w-[58ch] border-l-2 border-accent pl-4 font-sans">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
        {label}
      </p>
      <div className="mt-1.5 text-sm leading-relaxed text-muted">{children}</div>
    </aside>
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
