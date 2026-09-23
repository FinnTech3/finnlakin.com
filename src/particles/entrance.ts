import { pointerInCloudSpace } from "./mouse";
import type { ParticleTimelineState } from "./types";

/* Where the particles come in from.

   The opening was a modest puff: every particle started at about one and a half
   times its own distance from the centre and was drawn inward. Finn asked for
   something dramatic instead, particles flying in from the edges of the screen,
   and from every side of it rather than from the corners. That is a smaller
   change than it sounds, because the spring already knows how to pull a
   particle to where it belongs. All this decides is where each one starts.

   The one real difficulty is that the simulation has no idea what a screen is.
   It moves particles around a unit cube, and the chain from there to a pixel
   runs through the timeline's factor, then its rotation, then its offset, then
   the projection. So the rectangle just beyond the viewport is walked in screen
   space, where it is trivially described, and each point on it is carried back
   through that chain by the same inverse the pointer already uses.

   Portrait and landscape then need no branch between them. The rectangle is the
   viewport, whatever shape the viewport is, and a phone gets particles arriving
   from its long sides for the same reason a monitor gets them from its wide
   ones. */

/* How far beyond the viewport the entry rectangle sits, as a share of the half
   extent. Far enough that a particle and the bloom around it are outside the
   frame at the moment it is released, near enough that the flight does not read
   as a wait before anything happens. */
const OVERSHOOT = 1.25;

/* How much depth the entry has, in world units, centred on the cloud's own
   plane. Started on a single plane the arrival reads as a flat sheet closing
   in; given a little depth the particles pass each other on the way, which is
   most of what makes it look like a swarm rather than a slide.

   In world units rather than the simulation's, because it is resolved along the
   ray through the screen point: a particle placed further from the camera is
   placed proportionally wider, so it stays exactly on the edge of the frame
   whatever depth it enters at. Added afterwards in the simulation's own space
   instead, which is what this did first, a rotated cloud carries part of that
   depth into the horizontal and a tenth of the particles start on screen. On a
   portrait phone, where the frame is narrow, it was an eighth of them. */
const DEPTH_SPREAD = 3;

/* A point on that rectangle, in screen coordinates running minus one to one.

   The four edges take shares of the walk in proportion to their length rather
   than a quarter each. Their lengths differ by the aspect ratio, and a quarter
   each would put twice as many particles per centimetre on the short sides of a
   wide monitor as on the long ones. That is visible rather than theoretical:
   the sides fountain and the top and bottom trickle. */
export function perimeterPoint(fraction: number, aspect: number): { x: number; y: number } {
  const t = fraction - Math.floor(fraction);
  /* The share of the perimeter belonging to the top and bottom together. The
     half width is the half height times the aspect, so the ratio of one edge to
     the sum of two adjacent ones reduces to this. */
  const horizontal = aspect / (1 + aspect);

  if (t < horizontal) {
    const half = Math.max(1e-6, horizontal / 2);
    const top = t < half;
    const along = (top ? t : t - half) / half;
    return { x: (along * 2 - 1) * OVERSHOOT, y: top ? OVERSHOOT : -OVERSHOOT };
  }

  const rest = t - horizontal;
  const half = Math.max(1e-6, (1 - horizontal) / 2);
  const left = rest < half;
  const along = (left ? rest : rest - half) / half;
  return { x: left ? -OVERSHOOT : OVERSHOOT, y: (along * 2 - 1) * OVERSHOOT };
}

/* Writes one particle's starting position, in the simulation's own space.

   Written in place rather than returned, because this runs once per particle
   and ten thousand three element arrays is ten thousand allocations for a value
   that is read once and thrown away. */
export type EntryField = (out: Float32Array, offset: number) => void;

export function entryField(
  timeline: ParticleTimelineState,
  aspect: number,
  random: () => number,
): EntryField {
  return (out, offset) => {
    /* Independent of where the particle is going. Tying the entry point to the
       target's own direction gives a tidier flight, and on the opening word,
       which is a wide thin band across the middle of the screen, it also means
       almost everything arrives from the left and the right. Finn asked for
       every side, so every side gets an equal share whatever shape is being
       assembled. */
    const screen = perimeterPoint(random(), aspect);
    const [x, y, z] = pointerInCloudSpace(
      screen,
      timeline,
      aspect,
      (random() - 0.5) * DEPTH_SPREAD,
    );
    out[offset] = x;
    out[offset + 1] = y;
    out[offset + 2] = z;
  };
}
