/* The four colours the site is made of.

   The stylesheet holds the same four as custom properties. These are for the
   places that cannot read a stylesheet: the viewport's theme colour, the web
   manifest, the share cards, and the icon generator. tests/platform.spec.ts
   asserts that the wall here is the wall the page paints, so the two cannot
   drift apart unnoticed. */
export const wall = "#a7a39b";
export const carbon = "#121212";
export const chalk = "#f4f2ee";
export const acid = "#d4ff3a";
