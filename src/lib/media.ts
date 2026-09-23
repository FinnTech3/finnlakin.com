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
  /* Relative to /public. The rendition a clip is given beside a project, where
     it renders about seven hundred pixels wide and 4K would be payload nobody
     can see. */
  src: string;
  /* The rendition /reel is given, where the clip is the full width of the
     screen and the resolution is the point.

     Absent on a clip whose source has no 4K rendition at all, in which case
     `src` is the ceiling rather than an upscale of it: a 1080 frame stretched
     to 3840 is not 4K, it is a larger file with the same detail in it. */
  srcFull?: string;
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
    src: "/media/11-1080.mp4",
    srcFull: "/media/11-2160.mp4",
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
    src: "/media/4067-1080.mp4",
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
    src: "/media/42343-1080.mp4",
    srcFull: "/media/42343-2160.mp4",
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
    src: "/media/51585-1080.mp4",
    srcFull: "/media/51585-2160.mp4",
    poster: "/media/51585.jpg",
    description:
      "A camera moving slowly up a shallow creek in daylight, water running over a bed of rock between wooded banks.",
    caption:
      "The one bright frame on the site, and it is here on purpose: a portfolio about market microstructure that has never once looked out of the window is a portfolio about a screen.",
    credit: "Mixkit, free licence",
    href: mixkit("flying-over-a-relaxing-creek-full-of-rock-on-the-51585"),
    origin: "stock",
  },
  {
    id: "surface",
    src: "/media/50748-1080.mp4",
    poster: "/media/50748.jpg",
    description:
      "Several screens filled with scrolling logs and configuration text, green and amber on deep blue, updating faster than they can be read.",
    caption:
      "A published surface is this: thousands of numbers arriving faster than anybody checks them. The whole project is one long look at what is in there.",
    credit: "Mixkit, free licence",
    href: mixkit(
      "computer-screens-display-green-text-and-matrix-like-scrolling-50748",
    ),
    origin: "stock",
  },
  {
    id: "curve",
    src: "/media/44818-1080.mp4",
    poster: "/media/44818.jpg",
    description:
      "Black ink released into clear water, unfurling into a branching plume against a white field.",
    caption:
      "A curve is fitted to what is observed. What is derived from it inherits every assumption that went in, and spreads.",
    credit: "Mixkit, free licence",
    href: mixkit("abstract-video-of-a-liquid-with-dark-ink-flowing-44818"),
    origin: "stock",
  },
  {
    id: "search",
    src: "/media/4974-1080.mp4",
    poster: "/media/4974.jpg",
    description:
      "A monochrome composition of hard-edged geometric shapes turning against each other, arrows and facets in grey and white.",
    caption:
      "796 rules, searched. Somewhere in a space this shape there is always one that looks like skill.",
    credit: "Mixkit, free licence",
    href: mixkit("monochromatic-visual-compositions-4974"),
    origin: "stock",
  },
  {
    id: "charges",
    src: "/media/18263-1080.mp4",
    poster: "/media/18263.jpg",
    description:
      "Coins tipped from one open hand into another, counted out one at a time in close-up.",
    caption:
      "Costs are paid like this, a little at a time, which is why a backtest that ignores them can turn a loss into a plausible return.",
    credit: "Mixkit, free licence",
    href: mixkit("hands-of-a-man-counting-coins-close-up-view-18263"),
    origin: "stock",
  },
  {
    id: "banknote",
    src: "/media/18261-1080.mp4",
    poster: "/media/18261.jpg",
    description:
      "An extreme close-up of engraved line work on a banknote, the detail resolving into individual cuts.",
    caption:
      "One index number stands for every price everybody pays. Close enough in, it stops being one number.",
    credit: "Mixkit, free licence",
    href: mixkit("fast-sequence-of-detailed-photos-of-banknote-parts-18261"),
    origin: "stock",
  },
  {
    id: "mirror",
    src: "/media/50998-1080.mp4",
    poster: "/media/50998.jpg",
    description:
      "A roundabout filmed from directly overhead at night, headlights circling it in a continuous ring of light.",
    caption:
      "Following somebody else's route exactly still costs you the traffic. That gap is the whole question here.",
    credit: "Mixkit, free licence",
    href: mixkit("top-view-of-the-traffic-around-a-roundabout-at-night-50998"),
    origin: "stock",
  },
  {
    id: "housing",
    src: "/media/4352-1080.mp4",
    poster: "/media/4352.jpg",
    description:
      "An elevated view along a street of European apartment blocks in daylight, balconies and mansard roofs running into the distance.",
    caption:
      "The decision this models is not financial for most people. The arithmetic still has an answer, and it moves a long way on assumptions nobody states.",
    credit: "Mixkit, free licence",
    href: mixkit("european-style-buildings-4352"),
    origin: "stock",
  },
  {
    id: "dusk",
    src: "/media/41375-1080.mp4",
    poster: "/media/41375.jpg",
    description:
      "A city seen from high above at dusk, the last band of red light along the horizon and the grid beginning to come on below.",
    caption:
      "Most of what a market does is not visible from here either. The tool exists to pull one part of it into view.",
    credit: "Mixkit, free licence",
    href: mixkit("tour-high-above-a-city-at-dusk-41375"),
    origin: "stock",
  },
];

export const clipById = new Map(clips.map((clip) => [clip.id, clip]));

/* What /reel shows, and in what order.

   Four, not twelve. Every clip in this file used to appear there, which was
   fine when there were four of them and would make the reel a scroll through
   the entire media folder now that there are twelve. These are the ones that
   carry a 4K rendition and are worth the width of a screen; the rest exist to
   sit beside a project at a size where 4K would be payload nobody can see. */
export const reelClips = [
  "interchange",
  "throughput",
  "city",
  "creek",
] as const;

/* Which clip sits beside which project.

   All ten have one, on Finn's instruction, and the reasoning against it is
   recorded in ATTENTION.md rather than quietly acted on: readers are documented
   to skip imagery that reads as decorative, and about half of these are
   atmosphere rather than evidence. A screen recording of the thing actually
   running would beat any of them, and each one here is a placeholder for that.

   Every poster frame was looked at before its file was committed. Two otherwise
   usable clips were rejected: a night traffic time lapse with legible signage on
   a building, and hands typing on a laptop, which breaks no rule and is the
   most skippable image on the internet. */
export const projectClips: Record<string, string> = {
  "marked-to-model": "surface",
  nanobook: "interchange",
  "term-premium": "curve",
  "deflated-sharpe": "search",
  "honest-backtest": "charges",
  orderbook: "throughput",
  "whose-inflation": "banknote",
  "trade-mirror": "mirror",
  "rent-or-buy": "housing",
  "finance-analysis": "dusk",
};
