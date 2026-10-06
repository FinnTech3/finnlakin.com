"use client";

import dynamic from "next/dynamic";

import type { CloudSurface } from "@/particles/types";

/* The cloud, on a design direction's own page, in that direction's medium.

   The site's own mount is bound to the home page and stays that way: it is the
   thing that keeps forty seven kilobytes of simulation and shaders out of every
   other route's bundle, and a direction under /looks is another route. So the
   directions mount it themselves, and pass the surface they are drawn on.

   Without server rendering, for the same reason the site's mount has none:
   every line of it touches WebGL and there is nothing a server could usefully
   render. */
const ParticleBrain = dynamic(
  () => import("./particle-brain").then((module) => module.ParticleBrain),
  { ssr: false },
);

export function LookBrain({ surface }: { surface: CloudSurface }) {
  return <ParticleBrain surface={surface} />;
}
