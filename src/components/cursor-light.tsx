"use client";

import { useEffect, useRef } from "react";
import { ladder } from "@/lib/ladder";

/* A lantern: a soft pool of the room's own colour that follows the pointer.

   It sits behind the words and over the wall, so it lights the room and never
   anything written in it, and it takes the room's tone as the wall changes. It
   is the pointer's presence on the page, the way the cloud parting around it is
   the pointer's presence in the cloud.

   Moved with a transform and nothing else: the element is a fixed square with a
   radial gradient painted once, and moving it is the compositor's work and not a
   repaint of the window, which is what makes it cheap enough to be decoration.
   It is still decoration, so it joins the page's frame ladder above everything
   else and is the first thing given up when frames run long, and it never moves
   for a reader who asked for less motion or on a screen with no pointer that
   hovers. Where there is no ladder it follows the pointer on frames of its own.

   It lives inside <main> and not beside it. The tests that photograph the wall
   and the cloud with the page hidden hide <main>, and a pool of light that is
   not part of the page would be in every one of those photographs. */
const FOLLOW = 0.16;

export function CursorLight() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const light = ref.current;
    if (!light) return;
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let target: { x: number; y: number } | null = null;
    let at: { x: number; y: number } | null = null;
    let frame = 0;
    let leave: (() => void) | null = null;

    const step = () => {
      frame = 0;
      if (!target) return;
      at = at
        ? { x: at.x + (target.x - at.x) * FOLLOW, y: at.y + (target.y - at.y) * FOLLOW }
        : { ...target };
      light.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
      const settled = Math.hypot(target.x - at.x, target.y - at.y) < 0.5;
      if (!settled) request();
      else leave?.();
    };

    const request = () => {
      const page = ladder();
      if (page) {
        leave ??= page.add({
          rank: 1050,
          draw: () => {
            step();
            if (!target || (at && Math.hypot(target.x - at.x, target.y - at.y) < 0.5)) {
              leave?.();
              leave = null;
            }
          },
          onShed: () => {
            light.removeAttribute("data-on");
            leave?.();
            leave = null;
          },
        });
      } else if (!frame) {
        frame = requestAnimationFrame(step);
      }
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      target = { x: event.clientX, y: event.clientY };
      light.setAttribute("data-on", "");
      request();
    };
    const onLeave = () => {
      light.removeAttribute("data-on");
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      leave?.();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <div ref={ref} aria-hidden="true" className="cursor-light" />;
}
