import type { ReactNode } from "react";

export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-b border-rule">
      <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          {eyebrow}
        </p>
        <h2 className="mt-3 font-serif text-[clamp(1.8rem,4.5vw,2.5rem)] leading-[1.1] tracking-[-0.02em]">
          {title}
        </h2>
        {intro ? (
          <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-muted">
            {intro}
          </p>
        ) : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
