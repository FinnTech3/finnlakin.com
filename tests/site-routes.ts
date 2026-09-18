import { writing } from "../src/lib/writing";

/* Derived from the content rather than hand-listed, so a new write-up is
   covered by the route, accessibility, head-tag and CSP suites the moment it
   is published. The previous hardcoded arrays silently left new pages
   untested, which is the worst kind of green. */
export const PUBLIC_ROUTES = [
  "/",
  "/writing",
  ...writing.map((piece) => `/writing/${piece.slug}`),
  "/path",
  "/cv",
  "/privacy",
];
