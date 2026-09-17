"use client";

import { useEffect, useRef } from "react";

import { createParticleBrain } from "@/particles/engine";
import { debugRequested, forcedLevel } from "@/particles/quality";
import type { ParticleBrain as Engine } from "@/particles/types";

/* The host. It owns a canvas, a frame loop and five listeners, and nothing
   else.

   Nothing that changes per frame is React state. Scroll position, pointer
   position, elapsed time and the state of ten thousand particles all live
   inside the engine, and this component renders once. A single setState in the
   loop would re-render the tree sixty times a second, which is the most common
   way an effect like this ends up costing ten times what it should. */

/* Long enough after the pointer stops that a pause while reading is not treated
   as the pointer having left, short enough that it settles while you watch. */
const POINTER_IDLE_MS = 900;

export function ParticleBrain({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const forced = forcedLevel();
    if (forced === "off") return;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const engine: Engine | null = createParticleBrain({
      canvas,
      quality: forced ?? undefined,
      reducedMotion,
    });

    /* Every failure path lands here: no WebGL2, no float render target, a
       shader that would not compile, a driver that refused a framebuffer. The
       page keeps the flat gradient it was already painting, and nobody is shown
       a blank rectangle where a picture should be. */
    if (!engine) {
      host.dataset.brain = "fallback";
      return;
    }

    let frame: number | null = null;
    let running = true;
    let idle: ReturnType<typeof setTimeout> | null = null;

    const tick = (now: number) => {
      frame = null;
      if (!running) return;
      engine.frame(now);
      /* A reader who has asked for less motion gets one settled frame per
         scroll or resize rather than a loop. Not a slower animation: a still
         picture that keeps up with the page. */
      if (!reducedMotion) frame = requestAnimationFrame(tick);
    };

    const pump = () => {
      if (!running || frame !== null || document.hidden) return;
      frame = requestAnimationFrame(tick);
    };

    const pause = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };

    const onPointerMove = (event: PointerEvent) => {
      engine.pointer(event.clientX, event.clientY);
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => engine.pointerLeave(), POINTER_IDLE_MS);
    };

    const onPointerLeave = () => {
      engine.pointerLeave();
    };

    const onScroll = () => {
      if (reducedMotion) pump();
    };

    const onResize = () => {
      engine.resize();
      pump();
    };

    const onVisibility = () => {
      if (document.hidden) pause();
      else pump();
    };

    /* A lost context is the browser reclaiming the GPU, usually under memory
       pressure. Asking for it back tends to lose it again; showing the flat
       gradient does not. */
    const onContextLost = (event: Event) => {
      event.preventDefault();
      running = false;
      pause();
      host.dataset.brain = "fallback";
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onContextLost);

    host.dataset.brain = reducedMotion ? "still" : "live";
    if (debugRequested()) host.dataset.brainDebug = "1";
    pump();

    return () => {
      running = false;
      pause();
      if (idle) clearTimeout(idle);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      engine.dispose();
    };
  }, []);

  /* Fixed, behind the content, and unreachable. pointer-events none is what
     stops it swallowing a click on a link, a drag across a paragraph or a tab
     to a button, and aria-hidden keeps it out of the reading order: it is
     decoration, and every figure on this site is real text elsewhere. */
  return (
    <div
      ref={hostRef}
      data-brain="idle"
      aria-hidden="true"
      className={className ?? "pointer-events-none fixed inset-0 -z-10 overflow-hidden"}
    >
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}
