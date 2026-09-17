"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { createParticleBrain } from "@/particles/engine";
import { debugRequested, forcedLevel } from "@/particles/quality";
import { STORAGE_KEY } from "@/components/intro";
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

/* However the opening animation ends, it is over by this point. A decoration
   must never be the reason a page cannot be read. */
const INTRO_CEILING_MS = 9_000;

/* Matches the transition in the stylesheet that fades the veil out. */
const VEIL_FADE_MS = 700;

export function ParticleBrain({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  /* The timeline is choreographed against the home page's seven sections, and a
     long read is the last place to put a moving background. It mounts beside
     the other background layers rather than inside the content, so that the
     accessibility and contrast tests can hide the page and still see it. */
  const active = pathname === "/";

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const forced = forcedLevel();
    if (forced === "off") return;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Decided before the first paint by the inline script in the layout, which
       is why this reads an attribute rather than checking the conditions again:
       by the time this runs, the page has already painted once. */
    const root = document.documentElement;
    const wantsIntro = root.dataset.intro === "running";

    let ceiling: ReturnType<typeof setTimeout> | null = null;
    let fade: ReturnType<typeof setTimeout> | null = null;
    let ended = false;

    const finishIntro = () => {
      if (ended) return;
      ended = true;
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* Private browsing can refuse this. The animation then plays again on
           the next page view, which is a smaller problem than throwing. */
      }
      root.dataset.intro = "ending";
      fade = setTimeout(() => {
        delete root.dataset.intro;
      }, VEIL_FADE_MS);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("wheel", skip);
      if (ceiling) clearTimeout(ceiling);
    };

    const skip = () => {
      engine?.endIntro();
      finishIntro();
    };

    const engine: Engine | null = createParticleBrain({
      canvas,
      quality: forced ?? undefined,
      reducedMotion,
      intro: wantsIntro,
      onIntroEnd: finishIntro,
    });

    /* Every failure path lands here: no WebGL2, no float render target, a
       shader that would not compile, a driver that refused a framebuffer. The
       page keeps the flat gradient it was already painting, and nobody is shown
       a blank rectangle where a picture should be. */
    if (!engine) {
      host.dataset.brain = "fallback";
      /* No engine means no animation to wait for, and leaving the attribute set
         would leave the page under an opaque black rectangle for ever. */
      if (wantsIntro) delete root.dataset.intro;
      return;
    }

    if (wantsIntro) {
      /* Any deliberate act ends it. */
      window.addEventListener("keydown", skip);
      window.addEventListener("pointerdown", skip);
      window.addEventListener("wheel", skip, { passive: true });
      ceiling = setTimeout(skip, INTRO_CEILING_MS);
    } else if (root.dataset.intro) {
      delete root.dataset.intro;
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
      if (ceiling) clearTimeout(ceiling);
      if (fade) clearTimeout(fade);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("wheel", skip);
      delete root.dataset.intro;
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      engine.dispose();
    };
  }, [active]);

  /* Fixed, behind the content, and unreachable. pointer-events none is what
     stops it swallowing a click on a link, a drag across a paragraph or a tab
     to a button, and aria-hidden keeps it out of the reading order: it is
     decoration, and every figure on this site is real text elsewhere. */
  if (!active) return null;

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
