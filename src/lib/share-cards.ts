import { siteTitle } from "./site";
import { writing } from "./writing";

/* The share card used to be an open endpoint: /api/og rendered whatever
   ?title= and ?kicker= a caller passed, on every request, with no cache
   header. Two problems followed from that. Every crawler fetching a preview
   re-rasterised a 1200x630 PNG from scratch, and anyone could mint unlimited
   distinct images by varying the query string.

   The cards are a closed set, because the pages are. Naming them here lets the
   route prerender all of them at build and refuse anything else, which is the
   same closed-allow-list shape the analytics collector already uses, and for
   the same reason: a pattern accepts whatever a stranger sends. */
export type ShareCard = {
  key: string;
  title: string;
  kicker?: string;
};

/* One key per public page, derived from its path so the two cannot drift
   apart by hand. */
export function cardKey(path: string): string {
  if (path === "/") return "home";
  return path.replace(/^\//, "").replace(/\//g, "-");
}

export const shareCards: ShareCard[] = [
  { key: cardKey("/"), title: siteTitle },
  { key: cardKey("/writing"), title: "Writing", kicker: "Writing" },
  { key: cardKey("/path"), title: "Where I have studied and worked", kicker: "Path" },
  { key: cardKey("/reel"), title: "Things that are easier to show than to say", kicker: "Reel" },
  { key: cardKey("/cv"), title: "CV", kicker: "CV" },
  { key: cardKey("/privacy"), title: "Privacy", kicker: "Privacy" },
  ...writing.map((piece) => ({
    key: cardKey(`/writing/${piece.slug}`),
    title: piece.title,
    kicker: piece.kicker,
  })),
];

export const shareCardByKey = new Map(shareCards.map((card) => [card.key, card]));

/* Falls back to the home card rather than 404ing the image, because a missing
   preview is a worse failure than a generic one. A page whose path has no card
   is caught by the head test instead, which is where it should surface. */
export function cardPathForPage(path: string): string {
  const key = cardKey(path);
  return `/og/${shareCardByKey.has(key) ? key : cardKey("/")}`;
}
