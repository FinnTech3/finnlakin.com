"use client";

import { useEffect, useRef } from "react";

import { createBrain, type Brain } from "./brain";
import type { Vec } from "./particles";

/* The constellation, in its own element rather than behind the page.

   It lived in the backdrop first, laid across the viewport under the scrim and
   faded out by scroll. Two things were wrong with that. It sat behind the
   headline and the reconstruction table, so it read as a picture squeezed
   behind a table rather than as the hero's other half. And the scrim capped how
   bright it could be, because anything under it lifts the background that every
   contrast ratio on the site is measured against.

   Here it owns a column, nothing is written over it, and the colours run at the
   strength the design reference asks for.

   It keeps its own frame loop, which the backdrop's guards do not cover, so it
   carries its own: it runs only while it is on screen, it stops in a hidden
   tab, it stops if the first frames are slow, and it draws one settled frame
   and nothing more for a reader who has asked for less motion. */

/* Frames 4 through 20 are timed. Past this the machine is not keeping up with
   anything worth animating, and a still picture is better than a stuttering
   one. */
const SLOW_FRAME_MS = 46;
const WARMUP_FRAMES = 4;
const SAMPLE_FRAMES = 20;

export function Constellation({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const cloud: Brain | null = createBrain(canvas);
    if (!cloud) return;
    const brain = cloud;
    const element = host;

    const stillOnly =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const measure = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width < 2 || height < 2) return false;
      brain.layout(width, height);
      return true;
    };

    let laid = measure();

    /* Stored, never acted on per event. The loop reads it once a frame.
       Coordinates are relative to this element, not the page, because that is
       what the cloud is laid out in. */
    let pointer: Vec | null = null;
    const onPointerMove = (event: PointerEvent) => {
      const box = host.getBoundingClientRect();
      pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const onPointerLeave = () => {
      pointer = null;
    };

    if (stillOnly) {
      if (laid) brain.draw(1, 0, null, true);
      const observer = new ResizeObserver(() => {
        laid = measure();
        if (laid) brain.draw(1, 0, null, true);
      });
      observer.observe(host);
      return () => observer.disconnect();
    }

    host.addEventListener("pointermove", onPointerMove, { passive: true });
    host.addEventListener("pointerleave", onPointerLeave, { passive: true });

    let frame: number | null = null;
    let running = true;
    let visible = true;
    let frames = 0;
    let sampleStart = 0;
    let previous = 0;
    const start = performance.now();

    const pump = () => {
      if (!running || frame !== null) return;
      if (document.hidden || !visible) return;
      previous = 0;
      frame = requestAnimationFrame(tick);
    };

    const pause = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };

    function tick(now: number) {
      frame = null;
      if (!running) return;
      if (!laid) laid = measure();

      const step = previous === 0 ? 1 : Math.min(3, Math.max(0.5, (now - previous) / 16.667));
      previous = now;
      brain.draw(step, (now - start) / 1000, pointer, false);

      frames += 1;
      if (frames === WARMUP_FRAMES) sampleStart = now;
      if (frames === SAMPLE_FRAMES) {
        const perFrame = (now - sampleStart) / (SAMPLE_FRAMES - WARMUP_FRAMES);
        if (perFrame > SLOW_FRAME_MS) {
          running = false;
          /* The finished picture, not whatever frame it stalled on. */
          brain.draw(1, 0, null, true);
          element.dataset.constellation = "still";
          return;
        }
      }

      frame = requestAnimationFrame(tick);
    }

    /* Off screen it does not draw at all, which on this page is most of a
       session: the cloud is in the opening screen and the rest of the site is
       below it. */
    const seen = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) pump();
        else pause();
      },
      { rootMargin: "120px" },
    );
    seen.observe(host);

    const onVisibility = () => {
      if (document.hidden) pause();
      else pump();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const observer = new ResizeObserver(() => {
      laid = measure();
    });
    observer.observe(host);

    host.dataset.constellation = "live";
    pump();

    return () => {
      running = false;
      pause();
      seen.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  /* aria-hidden: it is decoration. Nothing here is information a reader would
     miss, and the evidence it sits beside is real text. */
  return (
    <div
      ref={hostRef}
      className={className}
      data-constellation="idle"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} data-brain="" className="block size-full" />
    </div>
  );
}
