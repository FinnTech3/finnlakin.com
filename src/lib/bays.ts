/* The Bays: the other half of the work, held open.

   To fill one, put the file in public/bays/ and add `piece` to its entry below.
   Nothing else changes: the heading counts the filled ones, the empty ones stay
   as they are, and tests/bays.spec.ts checks that the file is there, that it has
   a description for somebody who cannot see it, and that its size is stated so
   the page does not move when it arrives.

   Only Finn's own work belongs here. There is nothing in this list that is
   anybody else's picture, and that is the point of it being empty. */
export type BayPiece = {
  /* A path under public/, such as "/bays/painting-01.jpg". */
  src: string;
  /* What is in it, for somebody who cannot see it. Required. */
  alt: string;
  /* The pixel size of the file, so the layout is settled before it loads. */
  width: number;
  height: number;
  /* Optional: a line under the label. */
  caption?: string;
};

export type Bay = { label: string; piece?: BayPiece };

export const bays: Bay[] = [
  { label: "Painting, drawing" },
  { label: "Photography, film" },
  { label: "3D, code" },
  { label: "Graphic design" },
  { label: "Archive, fashion" },
];
