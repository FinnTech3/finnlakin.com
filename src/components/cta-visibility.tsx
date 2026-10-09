"use client";

import { useEffect } from "react";

/* Marks the document when the hero's controls have left the screen, so their
   animation can be paused.

   Its own component, and that is deliberate on two counts. `ShinyButton` stays
   a server component that ships no JavaScript, which it could not if it watched
   itself. And the observer runs once for the pair rather than once per control,
   because they sit in the same block and leave the screen together.

   Nothing renders. The whole output is one attribute on the root element, which
   `globals.css` reads to pause `.shiny-cta`. */
export function CtaVisibility() {
  useEffect(() => {
    const root = document.documentElement;
    const target = document.querySelector("[data-cta-watch]");
    if (!target) return;

    /* No IntersectionObserver means no pausing, which is the safe way round:
       the controls animate as they always did rather than stopping forever. */
    if (typeof IntersectionObserver === "undefined") return;

    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        root.dataset.cta = entry.isIntersecting ? "on" : "off";
      },
      /* A margin, so the pause happens once they are properly gone rather than
         at the instant the last pixel crosses the edge. A control that stops
         moving while a sliver of it is still visible reads as a stutter. */
      { rootMargin: "120px" },
    );

    watcher.observe(target);
    return () => {
      watcher.disconnect();
      delete root.dataset.cta;
    };
  }, []);

  return null;
}
