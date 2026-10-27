"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { homeRoom } from "@/lib/rooms";

/* Loads the particle engine only on the page that has one.

   It used to be imported straight into the layout, which put it in the client
   bundle for every route: measured, a write-up was downloading forty seven
   kilobytes of simulation and shaders to render an essay. The timeline is
   choreographed against the home page's bands and nothing else uses it, so
   nothing else should pay for it.

   Loaded without server rendering, because the whole of it touches WebGL and
   there is nothing it could usefully render on a server. */
const ParticleBrain = dynamic(
  () => import("./particle-brain").then((module) => module.ParticleBrain),
  { ssr: false },
);

/* The cloud, in chalk, tinted by the room it is in.

   The engine draws light: particles accumulate additively, and the final pass
   reads the same buffer as a saturating coverage instead and lays it down as
   pigment. Pale where the cloud is thin and near white where it piles up, over
   a dark wall, that is chalk dust. See the Surfaces section of
   ParticleBrainREADME.md.

   The pigments are the first room's, midnight, and they are only where it
   starts: the cloud turns to the pigments of each room as the page changes
   rooms (see room-watcher.tsx and the tint in particle-brain.tsx). */
const surface = {
  kind: "ink",
  pale: homeRoom.pale,
  deep: homeRoom.deep,
  gain: 5.2,
} as const;

export function ParticleBrainMount() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return <ParticleBrain surface={surface} />;
}
