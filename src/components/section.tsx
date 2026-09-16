import type { ReactNode } from "react";

/* No border, no panel, no centred column. Sections are separated by space and
   the headline's own scale, which is what the design reference asks for, and
   they run the full width of the screen, which is what Finn asked for. The
   reading measure comes back on the intro paragraph, because a sentence that
   spans a wide monitor cannot be read. */
export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  /* A page whose main heading is a Section needs that heading to be the h1.
     On the home page the Hero owns the h1 and every Section below it is an
     h2. Without this, /writing and /privacy shipped with no h1 at all. */
  level = 2,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";

  return (
    <section id={id} className="gutter w-full py-20 sm:py-28">
      <p className="t-label text-spark">{eyebrow}</p>
      <Heading className="t-hsm mt-5 max-w-[22ch] text-ink text-balance">{title}</Heading>
      {intro ? (
        <p className="measure-tight mt-6 text-[18px] leading-relaxed font-extralight text-ink-soft">
          {intro}
        </p>
      ) : null}
      <div className="mt-14">{children}</div>
    </section>
  );
}
