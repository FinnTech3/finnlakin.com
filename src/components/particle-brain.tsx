"use client";

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


/* However the opening animation ends, it is over by this point. A decoration
   must never be the reason a page cannot be read. */
const INTRO_CEILING_MS = 9_000;

/* Matches the transition in the stylesheet that fades the veil out. */
const VEIL_FADE_MS = 700;

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
      /* The scroll comes back here rather than when the veil finishes fading,
         because the page underneath is complete and the reader is already
         looking at it through a dissolving black sheet. */
      root.removeAttribute("data-intro-locked");
      window.scrollTo(0, 0);
      if (ceiling) clearTimeout(ceiling);
    };

    /* Escape, and nothing else.

       This used to end on a wheel tick, a key press or a pointer press, on the
       reasoning that any deliberate act should end it. A wheel tick is not a
       deliberate act of ending anything: it is a reader scrolling, which is the
       first thing anybody does on a page, and the animation was over before it
       had begun for most of them. Arrow keys and the space bar went the same
       way, through the key listener, because those scroll too.

       So the page is held still while it runs and the one way out is the key
       that means "out". The ceiling below and the twelve second timeout in the
       boot script are both still there, so nobody is ever stuck behind it. */
    const skip = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
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
      window.addEventListener("keydown", skip);
      /* Held still while it runs.

         Not only so that scrolling cannot cut it short. The animation holds the
         cloud's composition fixed while it plays, and the scroll position is
         settled rather than eased at the hand-over, so a page that has moved
         underneath it makes the hand-over a jump from the opening composition
         to wherever the reader has got to. Starting at the top is also the only
         position the opening is composed for.

         A reload restores the previous scroll position, which is why this
         scrolls to the top rather than assuming it is already there. */
      root.setAttribute("data-intro-locked", "");
      window.scrollTo(0, 0);
      ceiling = setTimeout(() => {
        engine?.endIntro();
        finishIntro();
      }, INTRO_CEILING_MS);
    } else if (root.dataset.intro) {
      delete root.dataset.intro;
    }

    let frame: number | null = null;
    let running = true;

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

    /* No idle timeout. A cursor resting on the cloud should hold it open, the
       way a hand held in a shoal does; the hole closes when the pointer leaves
       the window, not when it stops moving. */
    const onPointerMove = (event: PointerEvent) => {
      engine.pointer(event.clientX, event.clientY);
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

    /* Only where there is a pointer that hovers. On a touch screen there is no
       cursor to part the cloud around, and a finger that has to touch the glass
       to be heard would scatter the particles under whatever the reader was
       trying to tap. */
    const hovers = window.matchMedia?.("(hover: hover)").matches ?? true;
    if (hovers) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("pointerleave", onPointerLeave);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onContextLost);

    host.dataset.brain = reducedMotion ? "still" : "live";
    if (debugRequested()) {
      host.dataset.brainDebug = "1";
      /* Behind the flag, and only behind the flag. The specification asks for a
         way to see what the engine thinks is happening, and a handle on the
         engine is the smallest version of that: the tests read the pointer and
         the quality level through it rather than inferring them from pixels. */
      (window as unknown as { particleBrain?: Engine }).particleBrain = engine;
    }
    pump();

    return () => {
      running = false;
      pause();
      if (ceiling) clearTimeout(ceiling);
      if (fade) clearTimeout(fade);
      window.removeEventListener("keydown", skip);
      delete root.dataset.intro;
      /* The lock has to come off here as well. Unmounting mid-intro, which a
         route change does, would otherwise leave the document unable to
         scroll. */
      root.removeAttribute("data-intro-locked");
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      delete (window as unknown as { particleBrain?: Engine }).particleBrain;
      engine.dispose();
    };
  }, []);

  /* Fixed and unreachable. pointer-events none is what stops it swallowing a
     click on a link, a drag across a paragraph or a tab to a button, and
     aria-hidden keeps it out of the reading order: it is decoration, and every
     figure on this site is real text elsewhere.

     Which layer it sits in is not fixed, and that is in globals.css rather than
     here because the engine drives it. Behind the page on the dark stage, where
     the stage is transparent and the cloud shows through it; in front of the
     page on the paper half, where it cannot be behind anything, because every
     paper band carries an opaque background of its own and a canvas underneath
     one is a canvas nobody sees. */
  return (
    <div
      ref={hostRef}
      data-brain="idle"
      aria-hidden="true"
      className={className ?? "brain-host"}
    >
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}
