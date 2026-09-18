import type { ReactNode } from "react";

/* Paper. Sections are centred at the brief's 1200px measure, separated by its
   80px gap, and alternate between paper white and the fog band so the page has
   a rhythm without a rule anywhere in it.

   The eyebrow is a typographic tag rather than a spaced small-cap label: the
   brief's own category markers are sentence case grey with no background, and
   on white the grey is enough to make a label read as one.

   The heading is the serif, which is the whole signature of this system, at
   weight 400 like every other heading on the site. */
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
  /* Which surface the band sits on. The brief alternates paper white and fog
     to break the canvas up without introducing contrast; a page states the
     rhythm rather than each section guessing at it. */
  band = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
  level?: 1 | 2;
  band?: boolean;
}) {
  const Heading = level === 1 ? "h1" : "h2";

  return (
    <section id={id} className={`w-full ${band ? "bg-band" : "bg-paper"}`}>
      <div className="shell py-16 sm:py-20 lg:py-28">
        <p className="t-label">{eyebrow}</p>
        <Heading className="t-h mt-4 max-w-[20ch] text-ink text-balance">{title}</Heading>
        {intro ? (
          <p className="measure-tight t-body-lg mt-6 text-muted">{intro}</p>
        ) : null}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}
