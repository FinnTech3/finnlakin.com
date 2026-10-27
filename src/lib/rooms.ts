import type { ShapeName } from "@/particles/structures";

/* The rooms: one colour world for each shape the cloud takes.

   The page used to be one wall, and one wall for twenty six thousand pixels of
   scrolling is the thing that made it feel the same all the way down. Now the
   wall changes with the cloud. When the cloud is the brain the page is
   midnight; when it becomes a surface the page is lagoon; when it becomes the
   order book it is ember. The two change together, as one event, so a change
   of shape is a change of weather and not only of particles.

   A room is its wall, its tone, and the two pigments the cloud is drawn in
   while it is there. The wall is a flat colour: nothing in the page paints a
   gradient behind the words, because the tests that prove the cloud is never
   under a word read the wall off a photograph as its commonest colour, and a
   wall that is not one colour has no commonest one.

   All seven are dark and none is black, which is what lets one rule hold for
   every one of them: cream type on the wall is at least 10.7 to 1, and the two
   quiet steps of it are at least 6.6 and 5.5 to 1, against 4.5 asked for.
   scripts/check-rooms.ts works the whole table out and fails the lint if a
   room is ever moved to a place that breaks it, and also that this table and
   the stylesheet agree.

   The tone is the room's own colour for the things that are decoration and
   never the only thing saying something: a numeral, a rule that lights, the
   tint of the cloud. Acid is the one colour that is the same in every room,
   because it is the colour of the highlight, the link and the result that did
   not hold. */
export type RoomName =
  | "midnight"
  | "lagoon"
  | "indigo"
  | "ember"
  | "orchid"
  | "forest"
  | "wine";

export type Room = {
  name: RoomName;
  /* The page, painted on the root element and on nothing else. */
  wall: string;
  /* Its own colour for decoration. */
  tone: string;
  /* The cloud while it is here: the pigment where the laydown is thin, and
     where it is heaviest. */
  pale: string;
  deep: string;
};

export const rooms: Record<RoomName, Room> = {
  midnight: { name: "midnight", wall: "#0b1230", tone: "#8fa6ff", pale: "#9db1ff", deep: "#f5f7ff" },
  lagoon: { name: "lagoon", wall: "#06353a", tone: "#5ff0cf", pale: "#83f2d9", deep: "#f1fffb" },
  indigo: { name: "indigo", wall: "#1c1468", tone: "#b9a6ff", pale: "#c0aeff", deep: "#fbf8ff" },
  ember: { name: "ember", wall: "#4a1a08", tone: "#ffb36b", pale: "#ffbe82", deep: "#fff4e5" },
  orchid: { name: "orchid", wall: "#4a0f57", tone: "#ff9be4", pale: "#ffa8e8", deep: "#fff1fc" },
  forest: { name: "forest", wall: "#0b3d27", tone: "#a8f07a", pale: "#b4f28b", deep: "#f8fff1" },
  wine: { name: "wine", wall: "#59102e", tone: "#ff9c9c", pale: "#ffa9a9", deep: "#fff2f2" },
};

/* Which room goes with which shape. One to one, so a shape that comes back
   brings its room back with it: the brain is always midnight, and the page
   closes on the colour it opened with. */
export const roomOfShape: Record<ShapeName, RoomName> = {
  brain: "midnight",
  surface: "lagoon",
  field: "indigo",
  skyline: "ember",
  network: "orchid",
  helix: "forest",
  drape: "wine",
};

/* The room a page starts in, before anything has been scrolled: the first
   screen, the opening's veil, the manifest and the browser's own chrome. */
export const homeRoom: Room = rooms.midnight;

/* Cream type, the same in every room. */
export const cream = "#f4efe6";

/* The event the room watcher sends when the page changes room, and the cloud
   listens for to take on the room's tint. The detail is the room. */
export const ROOM_EVENT = "fl-room";

/* Six digit hex to its three channels and back, for the cloud's pigments as they
   turn from one room's to the next. Kept as floats while they move, so a small
   step is never rounded to no step at all. */
export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const at = (i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return [at(0), at(1), at(2)];
}

export function rgbToHex(rgb: Rgb): string {
  const part = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`;
}
