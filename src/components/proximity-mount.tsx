"use client";

import { useEffect } from "react";

/* Starts the letter weight effect, and only where it can be felt.

   A pointer that hovers, so a phone or a tablet never downloads it: the effect
   follows a cursor, and a finger has none. Loaded after hydration, so it is
   never part of what the page needs to paint. See
   components/ui/variable-proximity.ts. */
export function ProximityMount() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("@/components/ui/variable-proximity").then((module) => {
      if (!cancelled) stop = module.startVariableProximity();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return null;
}
