import type { ReactNode } from "react";

/* A section of the wall: a scored line, a label, a headline, and what the
   section is about.

   The line is inside the section's own container and not on the band, and that
   is load bearing. On the home page a band spans the whole window with the lane
   as padding, so a rule drawn on the band would run through the lane under the
   cloud. Drawn on a block inside it, the rule stops where the content stops.

   The heading is the headline face at the section size. The eyebrow is a label,
   not a second heading. */
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
  /* Which side of the band the particle cloud travels down, so the content
     takes the other. Undefined is an ordinary column, which is what every route
     but the home page wants: the cloud is only on the home page, and a lane with
     nothing in it is a wasted third of the screen. */
  lane,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
  level?: 1 | 2;
  lane?: "left" | "right";
}) {
  const Heading = level === 1 ? "h1" : "h2";
  const laneClass = lane ? ` band-lane-${lane}` : "";
  const inner = lane ? "band-inner" : "shell";

  return (
    <section id={id} className={`w-full${laneClass}`}>
      <div className={`${inner} section-pad`}>
        <div className="scored pt-3">
          <p className="t-label">{eyebrow}</p>
        </div>
        <Heading className="t-h mt-8 max-w-[8.5em] text-ink text-balance">{title}</Heading>
        {intro ? <p className="measure t-body-lg mt-6 text-ink-soft">{intro}</p> : null}
        {/* A container, so what is inside can lay itself out against the room
            the band actually gives it rather than against the window. On the
            home page a band leaves two fifths of the screen to the particle
            cloud, so a four column grid written against sm: and lg: gets a
            quarter of three fifths of the screen per column and sets one word
            to a line. */}
        <div className="@container mt-12">{children}</div>
      </div>
    </section>
  );
}
