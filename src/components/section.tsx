import type { ReactNode } from "react";
import type { Lane } from "@/lib/bands";
import type { ShapeName } from "@/particles/structures";

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
  /* What shape the cloud is while it is beside this band. Only meaningful with
     a lane, because the cloud is only on the home page. See lib/bands.ts. */
  shape,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
  level?: 1 | 2;
  lane?: Lane;
  shape?: ShapeName;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  const laneClass = lane ? ` band-lane-${lane}` : "";
  const inner = lane ? "band-inner" : "shell";

  return (
    <section
      id={id}
      className={`w-full${laneClass}`}
      data-band={lane ? "" : undefined}
      data-shape={lane ? shape : undefined}
    >
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

/* A band that carries on a section rather than starting one: no label and no
   heading, only the room round its content that the cloud changes sides in.

   The work is one section of the page and several bands of the cloud's
   choreography, because the cloud has to change side and shape inside it. The
   first band is the Section, with the heading and the index; the ones after it
   are these. Each is its own element for the same reason a section is, which is
   that the engine reads a band's side and shape off the element and measures the
   room above and below its first child for the seam.

   Below the breakpoint the lane collapses and so does the room, because a page
   with no cloud to cross has no use for a hundred pixels of nothing between two
   entries of the same list. */
export function Band({
  id,
  lane,
  shape,
  children,
}: {
  id: string;
  lane: Lane;
  shape: ShapeName;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`w-full band-lane-${lane}`} data-band="" data-shape={shape}>
      <div className="band-inner band-pad">{children}</div>
    </section>
  );
}
