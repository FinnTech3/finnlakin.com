import { homeRoom } from "./rooms";

/* The colours the site is made of that do not change from room to room.

   The stylesheet holds the same values as custom properties. These are for the
   places that cannot read a stylesheet: the viewport's theme colour, the web
   manifest, the share cards, and the icon generator. tests/platform.spec.ts
   asserts that the wall here is the wall the page paints on its first screen,
   so the two cannot drift apart unnoticed.

   The wall is the first room's, midnight, because that is the room a page is
   in before anything has been scrolled and the one the opening animation's
   veil matches. The other six are in rooms.ts. */
export const wall = homeRoom.wall;
export const carbon = "#121212";
export const chalk = "#f4f2ee";
export const acid = "#d4ff3a";
