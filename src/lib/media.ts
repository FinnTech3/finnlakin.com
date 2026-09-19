/* The clips and stills the site carries, with where each one came from.

   Same rule as every other claim on this site: if it cannot be sourced it does
   not appear. public/media/SOURCE.md holds the licence in full and the reason
   each clip was chosen; this is the typed half, so a page cannot reference a
   file that has no provenance beside it.

   Nothing here is a screenshot of Finn's own work. Those need the projects
   actually running, and a picture of software nobody has run is exactly the
   kind of claim this site exists to argue against. When the recordings arrive
   they go in this list with `origin: "own"` and the rest of the page does not
   change. */
export type Clip = {
  id: string;
  /* Relative to /public. */
  src: string;
  poster: string;
  /* What is actually in the frame, in a sentence. Doubles as the accessible
     description, so it describes rather than titles. */
  description: string;
  /* The line printed under the clip. Says what it is doing here. */
  caption: string;
  credit: string;
  href: string;
  origin: "stock" | "own";
};

const mixkit = (id: string) => `https://mixkit.co/free-stock-video/${id}/`;

export const clips: Clip[] = [
  {
    id: "interchange",
    src: "/media/11-720.mp4",
    poster: "/media/11.jpg",
    description:
      "A motorway interchange filmed from directly above at night, traffic drawing continuous lines of white and red light through the junction.",
    caption:
      "Every car here is taking a route it chose from a few, and the pattern that comes out is nobody's plan. That is most of what an order book is.",
    credit: "Mixkit, free licence",
    href: mixkit("aerial-view-of-city-traffic-at-night-11"),
    origin: "stock",
  },
  {
    id: "throughput",
    src: "/media/4067-720.mp4",
    poster: "/media/4067.jpg",
    description:
      "A long exposure of a sunken motorway at dusk, headlights and tail lights drawn out into unbroken streaks running to the horizon.",
    caption:
      "Latency is the only number here that a picture can carry: the gap between one of these and the next.",
    credit: "Mixkit, free licence",
    href: mixkit("traffic-in-an-underground-tunnel-4067"),
    origin: "stock",
  },
  {
    id: "city",
    src: "/media/42343-360.mp4",
    poster: "/media/42343.jpg",
    description:
      "A slow aerial drift over a city at night, office towers lit from inside and a line of blue light running up one of them.",
    caption:
      "Somewhere in one of these a published number is being computed, and this site is an argument that you should be able to rebuild it from outside.",
    credit: "Mixkit, free licence",
    href: mixkit("movement-in-a-city-at-night-in-an-aerial-shot-42343"),
    origin: "stock",
  },
  {
    id: "creek",
    src: "/media/51585-360.mp4",
    poster: "/media/51585.jpg",
    description:
      "A camera moving slowly up a shallow creek in daylight, water running over a bed of rock between wooded banks.",
    caption:
      "The one bright frame on the site, and it is here on purpose: a portfolio about market microstructure that has never once looked out of the window is a portfolio about a screen.",
    credit: "Mixkit, free licence",
    href: mixkit("flying-over-a-relaxing-creek-full-of-rock-on-the-51585"),
    origin: "stock",
  },
];

export const clipById = new Map(clips.map((clip) => [clip.id, clip]));

/* Which clip sits beside which project, where one earns its place. Most
   projects have none: a decorative video beside a result is noise, and the
   figures built from the real numbers are the pictures that belong to them. */
export const projectClips: Record<string, string> = {
  nanobook: "interchange",
  orderbook: "throughput",
};
