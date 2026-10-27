"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/* Lets things arrive. Marks every element that asked for it (data-reveal) once
   it has come into view, and the stylesheet does the rest: a transform, and
   nothing that changes how legible a word is. See the note in globals.css.

   Renders nothing. An element is marked once and then left alone, so scrolling
   back up does not play it again, and an observer that has nothing left to
   watch is disconnected. Where there is no IntersectionObserver every element
   is marked at once, which is the page exactly as it would have been. */
export function Reveal() {
  const pathname = usePathname();

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((target) => target.setAttribute("data-in", ""));
      return;
    }

    let left = targets.length;
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-in", "");
          watcher.unobserve(entry.target);
          left -= 1;
        }
        if (left <= 0) watcher.disconnect();
      },
      /* A little before the bottom edge, so a thing is already on its way by the
         time it is properly in view. */
      { rootMargin: "0px 0px -6% 0px" },
    );
    targets.forEach((target) => watcher.observe(target));
    return () => watcher.disconnect();
  }, [pathname]);

  return null;
}
