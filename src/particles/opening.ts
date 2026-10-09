import { mapClamped } from "./pack";

/* The opening animation's schedule, in milliseconds from the engine's first
   frame, and nothing else. It is here rather than in the engine so that the
   things that must agree about it can be asserted against one statement of it:
   the engine plays it, the host's safety ceiling is measured from it, and
   scripts/check-motion.ts holds the second word on the screen for as long as
   it was asked to be.

   The first word assembles, becomes the second, and the second becomes the
   brain; then the hold on the composition is released and the page takes over.

   These began as the timings from the version Finn watched, kept because they
   were arrived at by watching rather than by reasoning, and one of them has
   been moved since on his word. */

/* The first word needs longer than it looks, and the reason is measurable
   rather than aesthetic. The reveal draws the cloud in over nine tenths of a
   second, and only once it has arrived does the spring start closing the last
   of the distance, which at a spring of six thousandths and a friction of 0.892
   takes about another seventy steps. So the word is not actually a word until
   roughly two seconds in. Starting the second phase at 2300 had it morphing
   away at the moment it became legible.

   The second word, ECONOMICS, FINANCE, SOFTWARE DEV, is formed by 4200 and then
   held. It was held for eight tenths of a second before the brain began to
   form and is held for one and eight tenths now: Finn asked for the pause to
   be a second longer, and the brain and everything after it moved by that
   second rather than the word's own morph being stretched, so the words still
   arrive at the pace they always did and then stay. */
export const OPENING = {
  wordTwoFrom: 3000,
  wordTwoTo: 4200,
  brainFrom: 6000,
  brainTo: 7300,
  /* When the brain starts moving from the middle of the screen, at the scale the
     words were drawn at, to the place and size the page opens with. It is most
     of the way formed by then, so what a reader sees is the thing assembling
     and then settling into position, and by the hand-over there is nothing
     left to move. */
  settleFrom: 6700,
  handoverAt: 7900,
} as const;

/* However the opening ends, it is over by this point, measured by the host from
   when the engine was built. A decoration must never be the reason a page cannot
   be read. It sits two seconds and a tenth past the hand-over, which is the room
   the engine's first frame and a slow machine's last one have to fit in. */
export const OPENING_CEILING_MS = 10_000;

/* How far through the two transitions the opening is: nought is the first word,
   one the second, two the brain. A function of the wall clock alone, so that the
   second word's hold is a flat stretch of it that can be looked at without
   running a browser. */
export function openingMorph(ms: number): number {
  return (
    mapClamped(ms, OPENING.wordTwoFrom, OPENING.wordTwoTo, 0, 1) +
    mapClamped(ms, OPENING.brainFrom, OPENING.brainTo, 0, 1)
  );
}
