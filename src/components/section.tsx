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
  /* Which surface the band sits on.

     Nothing, or a sheet of white at two percent. The brief alternates paper
     white and fog; on black the same rhythm is a barely lifted surface against
     none, and it has to stay barely lifted for a reason beyond taste: the
     particle cloud is drawn behind the page, so anything opaque here paints
     over it. That is not a hypothetical. The first build of this put the cloud
     behind sections with solid backgrounds and it rendered perfectly and showed
     nothing at all. */
  band = false,
  /* Which side of the band the particle cloud travels down, so the content
     takes the other. Undefined is a centred column at the ordinary measure,
     which is what every route but the home page wants: the cloud is only on
     the home page, and a lane with nothing in it is a wasted third of the
     screen. */
  lane,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
  level?: 1 | 2;
  band?: boolean;
  lane?: "left" | "right";
}) {
  const Heading = level === 1 ? "h1" : "h2";
  const laneClass = lane ? ` band-lane-${lane}` : "";
  const inner = lane ? "band-inner" : "shell";

  return (
    <section id={id} className={`w-full ${band ? "bg-band" : ""}${laneClass}`}>
      <div className={`${inner} py-16 sm:py-20`}>
        <p className="t-label">{eyebrow}</p>
        <Heading className="t-h mt-4 max-w-[20ch] text-ink text-balance">{title}</Heading>
        {intro ? (
          <p className="measure-tight t-body-lg mt-6 text-muted">{intro}</p>
        ) : null}
        {/* A container, so what is inside can lay itself out against the room
            the band actually gives it rather than against the window. On the
            home page a band leaves a third of the screen to the particle cloud,
            so a four column grid written against sm: and lg: gets a quarter of
            two thirds of the screen per column and sets one word to a line. */}
        <div className="@container mt-12">{children}</div>
      </div>
    </section>
  );
}
