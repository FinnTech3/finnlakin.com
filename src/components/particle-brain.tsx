"use client";

import { useEffect, useRef } from "react";

import { frameScheduler } from "@/particles/frame";
import { createParticleBrain } from "@/particles/engine";
import { debugRequested, forcedLevel } from "@/particles/quality";
import { STORAGE_KEY } from "@/components/intro";
import type { CloudSurface, ParticleBrain as Engine } from "@/particles/types";

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

export function ParticleBrain({
  className,
  surface,
}: {
  className?: string;
  /* What the cloud is drawn in. Omitted is light, which is what a dark page
     wants and what the home page has always had. A page on paper passes its
     own pigments, and a two ink page passes its sheet as well: see
     CloudSurface. */
  surface?: CloudSurface;
}) {
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
      root.removeAttribute("data-intro-owned");
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

    /* Below the breakpoint the canvas covers the page from its top to the
       bottom of the phone's slot, so the slot is inside it whatever height the
       header and the copy above it turn out to be. The stylesheet makes it at
       least a screen tall; this makes it reach the slot when the slot runs on
       past the fold, which on most phones it does. Set as a minimum height, so
       a phone's toolbar sliding away changes nothing here. Above the
       breakpoint the canvas is fixed to the window and this is cleared. */
    const wideQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(min-width: 1100px)")
        : null;
    const fitHost = () => {
      const slot = document.querySelector<HTMLElement>("[data-brain-slot]");
      const narrow = wideQuery ? !wideQuery.matches : window.innerWidth < 1100;
      const next =
        narrow && slot
          ? `${Math.ceil(slot.getBoundingClientRect().bottom + window.scrollY)}px`
          : "";
      if (host.style.minHeight === next) return false;
      host.style.minHeight = next;
      return true;
    };
    /* Before the engine exists, so it is built for the surface it will draw
       on rather than resized onto it a frame later. */
    fitHost();

    const engine: Engine | null = createParticleBrain({
      canvas,
      quality: forced ?? undefined,
      reducedMotion,
      intro: wantsIntro,
      onIntroEnd: finishIntro,
      config: surface ? { surface } : undefined,
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
      /* Taken over from the boot script's failsafe, which stands down for it.
         The ceiling below is the guarantee from here. */
      root.setAttribute("data-intro-owned", "");
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

    let running = true;
    /* Registered with the page's one scheduler rather than owning a loop.

       The cloud is rank 0: it is drawn first in a frame and it is the last
       thing given up when frames run long. The gradient behind it is rank 1 and
       is thinned, then dropped, before the cloud's own quality levels are
       touched at all. Two loops used to run here, each governing itself, and
       the result was that a slow machine shed the subject and kept the
       decoration. */
    let release: (() => void) | null = null;
    let frame: number | null = null;

    const draw = (now: number) => {
      if (!running) return;
      engine.frame(now);
    };

    /* The engine's quality levels are the scheduler's last rung, handed over
       rather than governed here, so the whole page gives things up in one
       order. The engine refuses both when a level was fixed by name. */
    const join = () =>
      frameScheduler().add({
        rank: 0,
        draw,
        degrade: engine.degrade,
        upgrade: engine.upgrade,
      });

    /* Whether any of the canvas is on screen. Above the breakpoint it is fixed
       to the window and always is. Below it the canvas covers the hero's first
       screen and scrolls away with it, and a phone that has scrolled on to the
       work is not asked to draw a brain nobody can see: on a phone that is the
       difference between the page costing battery for as long as it is open
       and costing it only at the top. */
    let onScreen = true;
    /* Where the page was when the last still frame was drawn. */
    let stillAt: number | null = null;

    /* A reader who has asked for less motion gets one settled frame per scroll
       or resize rather than a loop. Not a slower animation: a still picture
       that keeps up with the page. That path never joins the scheduler, because
       there is nothing continuous to schedule.

       A frame drawn while the page moves narrows the seam the cloud crosses on
       by how far it moved, for the compositor that has scrolled on ahead of
       it. The page coming to rest is not an event, so one more frame is drawn
       once it has stopped: the picture a reader is left looking at is the
       settled one, and not the last frame of a fling with its margin in. */
    const pump = () => {
      if (!running || document.hidden || !onScreen) return;
      if (reducedMotion) {
        if (frame !== null) return;
        frame = requestAnimationFrame((now) => {
          frame = null;
          const at = window.scrollY;
          draw(now);
          if (at !== stillAt) {
            stillAt = at;
            pump();
          }
        });
        return;
      }
      if (!release) release = join();
    };

    const pause = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      release?.();
      release = null;
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

    /* A resize reallocates every render target the cloud draws through, and
       the frames that do it are slow on any machine. The scheduler is told,
       so a reader dragging a window edge is not read as a machine that
       cannot keep up. */
    const onResize = () => {
      fitHost();
      engine.resize();
      frameScheduler().settle();
      pump();
    };

    /* The slot moves whenever anything above it changes height: the fonts
       arriving, the header wrapping, a rotated phone. Coalesced onto a frame,
       and the engine is only resized when the canvas actually changed. */
    let refitQueued = false;
    const refit = () => {
      if (refitQueued) return;
      refitQueued = true;
      requestAnimationFrame(() => {
        refitQueued = false;
        if (!running || !fitHost()) return;
        engine.resize();
        /* Resizing clears the canvas. Animated, the next frame is coming
           anyway; for a reader who asked for less motion it is not, so one
           settled frame is asked for, or the brain would stay blank. */
        pump();
      });
    };
    const layoutWatch =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refit);
    layoutWatch?.observe(document.body);
    document.fonts?.ready.then(refit).catch(() => {
      /* The observer above still catches the fonts landing. */
    });

    const onVisibility = () => {
      if (document.hidden) pause();
      else pump();
    };

    const sight =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            if (!entry) return;
            onScreen = entry.isIntersecting;
            if (onScreen) pump();
            else pause();
          });

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
    sight?.observe(host);

    if (!reducedMotion) release = join();
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
      root.removeAttribute("data-intro-owned");
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
      sight?.disconnect();
      layoutWatch?.disconnect();
      host.style.minHeight = "";
      delete (window as unknown as { particleBrain?: Engine }).particleBrain;
      engine.dispose();
    };
    /* Once, and the surface is deliberately not a dependency. It is the page's
       medium, fixed for as long as that page is mounted, and it arrives as a
       fresh object on every render: in the dependency list it would tear down
       thirty two thousand particles and rebuild them on any parent re-render.
       A page that wants to change medium without remounting would call the
       engine's own setConfig. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Unreachable. pointer-events none is what stops it swallowing a click on a
     link, a drag across a paragraph or a tab to a button, and aria-hidden keeps
     it out of the reading order: it is decoration, and every figure on this
     site is real text elsewhere.

     Where it sits is in globals.css: behind the page, fixed to the window where
     the page keeps a lane for it, and over the first screen where it does not.
     It comes out in front of the veil while the opening animation runs. */
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
