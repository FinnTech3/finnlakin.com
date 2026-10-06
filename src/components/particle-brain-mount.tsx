"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

/* Loads the particle engine only on the page that has one.

   It used to be imported straight into the layout, which put it in the client
   bundle for every route: measured, a write-up was downloading forty seven
   kilobytes of simulation and shaders to render an essay. The timeline is
   choreographed against the home page's seven sections and nothing else uses
   it, so nothing else should pay for it.

   Loaded without server rendering, because the whole of it touches WebGL and
   there is nothing it could usefully render on a server. */
const ParticleBrain = dynamic(
  () => import("./particle-brain").then((module) => module.ParticleBrain),
  { ssr: false },
);

/* The cloud, in chalk.

   The engine draws light: particles accumulate additively, and an accumulation
   of light is only ever visible over something dark. The wall is mid grey, so
   the final pass reads the same buffer as a saturating coverage instead and
   lays it down as pigment. Pale where the cloud is thin and near white where it
   piles up, over a grey wall, that is chalk dust, which is the one medium that
   suits a wall. See the Surfaces section of ParticleBrainREADME.md.

   The pigments are not the page's chalk. They are a touch darker at the thin
   end so a sparse edge sits in the wall instead of floating above it. */
const surface = {
  kind: "ink",
  pale: "#cfccc4",
  deep: "#f6f4f0",
  gain: 5.2,
} as const;

export function ParticleBrainMount() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return <ParticleBrain surface={surface} />;
}
