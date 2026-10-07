import type { ShapeName } from "@/particles/structures";

/* The home page, band by band: which side of the screen the particle cloud
   keeps beside each, and what shape it is while it is there.

   This is the whole of the cloud's choreography written down as a list, and the
   page, the engine's validators and the tests all read the same one. The page
   puts each band's lane and shape in its markup, and the engine reads them back
   out of the markup, so the list is the thing to change and nothing else is. A
   band is the unit the cloud changes its mind at: where two neighbours differ in
   side or in shape, the cloud gathers itself up, crosses the seam between
   them, and arrives as what the next one asked for.

   The work is the long one. Ten projects a page long, in one band, would leave
   the cloud on one side as one shape for most of the page, which is what it
   did, so the work is cut into bands of two and the sides alternate: the first
   two entries keep the content on the left and the cloud on the right, the next
   two the other way round, and so on down. The shape follows the cut. */

/* Which side of the band the cloud travels down, so the content takes the
   other. */
export type Lane = "left" | "right";

export type BandPlan = {
  id: string;
  lane: Lane;
  shape: ShapeName;
};

/* How many projects each band of the work holds. */
export const PROJECTS_PER_BAND = 2;

/* The shapes the work's bands take in turn, chosen for what each pair of
   projects is about and not for variety alone. The first pair is the mark
   surface that broke static arbitrage, so it is a surface; the second is a band
   of estimates that moves with its start date, which is data laid down in
   layers; the third is an order book; the fourth is trade between countries, a
   network; the fifth is break even over years of compounding, a strand. (The
   projects and their order are in lib/projects.ts.)

   A shape is not a claim, and nothing on the page says that this is what a
   project is. It is the cloud being something that belongs to the work beside it
   and not the brain from the first project to the last. The brain is the page's
   own opening and closing, and the work is the one place it is not. */
const WORK_SHAPES: readonly ShapeName[] = ["surface", "field", "skyline", "network", "helix"];

export function workBandCount(projects: number): number {
  return Math.max(1, Math.ceil(projects / PROJECTS_PER_BAND));
}

/* Every band of the home page, top to bottom, for a page with this many
   projects. A function of the count and not a fixed list so that an eleventh
   project makes a sixth band and does not quietly drop off the end of the
   page's markup. */
export function bandPlan(projects: number): BandPlan[] {
  const work: BandPlan[] = Array.from({ length: workBandCount(projects) }, (_, index) => ({
    id: index === 0 ? "work" : `work-${index + 1}`,
    lane: index % 2 === 0 ? "right" : "left",
    shape: WORK_SHAPES[index % WORK_SHAPES.length]!,
  }));

  return [
    { id: "hero", lane: "right", shape: "brain" },
    ...work,
    { id: "about", lane: "right", shape: "brain" },
    { id: "path", lane: "left", shape: "surface" },
    { id: "skills", lane: "left", shape: "drape" },
    { id: "endorsements", lane: "right", shape: "network" },
    { id: "contact", lane: "right", shape: "brain" },
  ];
}

/* One band's entry, by id. Throws for an id that is not in the plan, because a
   band that is on the page and not in the plan is a band the engine will read
   with no lane or shape and quietly treat as the brain on the right. */
export function bandOf(plan: readonly BandPlan[], id: string): BandPlan {
  const found = plan.find((band) => band.id === id);
  if (!found) throw new Error(`There is no band called ${id} in the plan.`);
  return found;
}
