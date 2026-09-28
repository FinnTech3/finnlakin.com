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

export function ParticleBrainMount() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return <ParticleBrain />;
}
