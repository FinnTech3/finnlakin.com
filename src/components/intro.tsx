"use client";

import { useEffect, useRef } from "react";

import {
  buildSprites,
  offscreenPoint,
  Particle,
  readTints,
  samplePoints,
  shuffle,
  TRIANGLE,
} from "./particles";

/* The opening animation. Adapted from the particle text effect Finn supplied:
   the flocking maths is his, everything around it is new, because the original
   could not run here as written.

   It would not compile. useRef<number>() is a type error under React 19, which
   is what this project is on.

   Its canvas was hardcoded to 1000x500, so the text was a stamp in the middle
   of a desktop screen and clipped on a phone.

   Its particles were 2x2 squares in Math.random() * 255. The design reference
   Finn sent has one signature gesture, outlined triangles in a fixed palette,
   and he asked for the intro and the background to share their shapes. They do
   now: the same four colours, the same triangle, and the dissolve scatters
   them outwards while the black lifts, so the gradient underneath is revealed
   rather than cut to. */

const STORAGE_KEY = "fl-intro-played";

/* Long edge of the drawing buffer. A phone at devicePixelRatio 3 would
   otherwise ask a software canvas to composite nine times the pixels for a
   picture made of 4px triangles. */
const MAX_EDGE = 1100;

/* Sampling stride through the rendered text, in buffer pixels. It came down
   from six when the words came down to a third of the screen: the stride has to
   scale with the letterform, or a smaller word is drawn with proportionally
   fewer particles and stops reading. */
const STRIDE = 4;

type Phase = { lines: string[]; at: number };

/* Two phases, then the dissolve.

   The second one breaks across three lines at every width, not just on a phone.
   Set as two lines it fitted at eighty-five pixels, where a letter stroke is
   under two sample points wide and the words came out as bars. Rendering the
   candidates as static targets settled it: three lines fit at a hundred and
   twenty-five pixels and read cleanly, at the cost of about a thousand more
   particles. */
function script(): Phase[] {
  return [
    { lines: ["FINN LAKIN"], at: 0 },
    { lines: ["ECONOMICS,", "FINANCE,", "SOFTWARE DEV"], at: 2300 },
  ];
}

const DISSOLVE_AT = 4600;
const DISSOLVE_MS = 900;
/* Nothing may leave the overlay up longer than this, whatever the animation is
   doing. A stalled frame loop is not allowed to hold the page hostage. */
const CEILING_MS = 6800;

export function Intro() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    /* The inline script in the document head owns this decision, because it has
       to be made before anything paints. If it did not set the attribute there
       is nothing to run. */
    if (document.documentElement.dataset.intro !== "running") return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      /* No 2D context at all. Take the overlay down rather than leaving a
         black rectangle over the page. */
      document.documentElement.removeAttribute("data-intro");
      return;
    }

    let done = false;
    const particles: Particle[] = [];
    const tints = readTints(
      ["--iris", "--spark", "--verdant", "--bone"],
      ["#8052ff", "#ffb829", "#15846e", "#ffffff"],
    );
    const sprites = buildSprites(tints);

    const rect = host.getBoundingClientRect();
    const scale = Math.min(
      window.devicePixelRatio || 1,
      MAX_EDGE / Math.max(rect.width, rect.height, 1),
    );
    const width = Math.max(2, Math.round(rect.width * scale));
    const height = Math.max(2, Math.round(rect.height * scale));
    canvas.width = width;
    canvas.height = height;

    const phases = script();
    let phaseIndex = -1;

    function finish() {
      if (done) return;
      done = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      document.documentElement.removeAttribute("data-intro");
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* Private browsing refuses to store. The intro then plays on every
           load in that tab, which is a smaller problem than a thrown error. */
      }
    }

    /* Sets the word, then hands each covered point to a particle. The sampling
       and the shuffle are shared with the constellation behind the hero: see
       samplePoints in ./particles. */
    function retarget(lines: string[]) {
      const family = getComputedStyle(document.body).fontFamily || "sans-serif";
      const longest = lines.reduce((a, b) => (a.length > b.length ? a : b));

      const spots = shuffle(
        samplePoints(width, height, STRIDE, (paint) => {
          /* The words sit inside the middle third of the screen, not across it.
             Two limits, and whichever bites first wins: the block may not be
             taller than a third of the height, and it may not be wider than
             WIDTH_SHARE of the width.

             The width share is not the same everywhere. A third of a laptop is
             a comfortable measure; a third of a phone is four characters wide
             and the word would be unreadable, so a narrow screen gets most of
             its width and the height limit is what holds the block in the
             middle band. */
          const narrow = width < height;
          const widthShare = narrow ? 0.82 : 0.38;
          const lineCount = lines.length;

          /* Start from the height limit, then pull back to the width limit if
             the longest line overruns it. */
          let size = Math.floor((height / 3) / (lineCount * 1.18));
          paint.font = `600 ${size}px ${family}`;
          const measured = paint.measureText(longest).width;
          const limit = width * widthShare;
          if (measured > limit) size = Math.floor((size * limit) / measured);
          size = Math.max(12, size);

          /* Weight 600, where the page sets its display type at 400. A headline
             at a hundred points can afford a light stroke; the same letterform
             sampled at a sixth of that size and stamped with a triangle every
             six pixels cannot. */
          paint.font = `600 ${size}px ${family}`;
          paint.fillStyle = "#ffffff";
          paint.textAlign = "center";
          paint.textBaseline = "middle";
          const leading = size * 1.18;
          const top = height / 2 - ((lineCount - 1) * leading) / 2;
          lines.forEach((line, index) => {
            paint.fillText(line, width / 2, top + index * leading);
          });
        }),
      );

      spots.forEach((spot, index) => {
        let particle = particles[index];
        if (!particle) {
          particle = new Particle();
          particle.pos = offscreenPoint(width, height);
          particle.maxSpeed = Math.random() * 10 + 14;
          particle.maxForce = particle.maxSpeed * 0.16;
          particle.tint = Math.floor(Math.random() * sprites.length);
          particles.push(particle);
        }
        particle.scattered = false;
        particle.target = spot;
      });

      /* More particles than the new phase needs: send the remainder out of
         frame rather than deleting them, so the two words are visibly the same
         cloud rearranging itself. */
      for (let i = spots.length; i < particles.length; i++) {
        const particle = particles[i]!;
        particle.scattered = true;
        particle.target = offscreenPoint(width, height);
      }
    }

    const start = performance.now();
    const ceiling = window.setTimeout(finish, CEILING_MS);

    let previous = 0;

    const tick = (now: number) => {
      if (done) return;
      const elapsed = now - start;

      /* Clamped at both ends: a first frame has no previous one to measure
         against, and a long stall must not teleport the cloud past its target
         and make the steering diverge. */
      const step = previous === 0 ? 1 : Math.min(3, Math.max(0.5, (now - previous) / 16.667));
      previous = now;

      const next = phases.reduce(
        (found, phase, index) => (elapsed >= phase.at ? index : found),
        -1,
      );
      if (next > phaseIndex) {
        phaseIndex = next;
        retarget(phases[next]!.lines);
      }

      const dissolving = elapsed >= DISSOLVE_AT;
      if (dissolving && particles.length > 0 && !particles[0]!.scattered) {
        /* Towards the constellation, not away from everything. The overlay is
           about to lift onto a field of the same triangles, so the last thing
           the word does is fly at where that field is, and the animation
           visibly becomes the thing that stays.

           Where that is comes from the element itself rather than from a number
           copied into this file: the cloud lives in the hero's second column
           now, so its box is whatever the layout gives it. If it is not on the
           page, the particles simply leave, which is what happens on every
           route that has no hero.

           A third of them leave regardless. All of them converging would read
           as a second word forming rather than as a cloud dispersing. */
        const target = document
          .querySelector("[data-constellation]")
          ?.getBoundingClientRect();
        for (const particle of particles) {
          particle.scattered = true;
          particle.target =
            target && Math.random() < 0.66
              ? {
                  x: (target.left + Math.random() * target.width) * scale,
                  y: (target.top + Math.random() * target.height) * scale,
                }
              : offscreenPoint(width, height);
          particle.maxSpeed *= 2.2;
        }
      }

      /* A translucent wash rather than a clear, which is what gives the
         particles their trails. It thins during the dissolve so the trails
         stretch as the black lifts. */
      const wash = Math.min(0.85, (dissolving ? 0.09 : 0.3) * step);
      ctx.fillStyle = `rgba(0, 0, 0, ${wash})`;
      ctx.fillRect(0, 0, width, height);

      for (const particle of particles) {
        particle.move(step);
        ctx.globalAlpha = particle.alpha;
        ctx.drawImage(
          sprites[particle.tint]!,
          particle.pos.x - TRIANGLE / 2,
          particle.pos.y - TRIANGLE / 2,
        );
      }
      ctx.globalAlpha = 1;

      if (dissolving) {
        const progress = Math.min(1, (elapsed - DISSOLVE_AT) / DISSOLVE_MS);
        host.style.opacity = String(1 - progress);
        if (progress === 1) {
          window.clearTimeout(ceiling);
          finish();
          return;
        }
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    /* Sampling the text before the face has loaded measures the fallback, so
       the particles would spell the word in the wrong letterforms. The race
       stops a font that never arrives from holding a black screen. */
    const ready = Promise.race([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise((resolve) => window.setTimeout(resolve, 600)),
    ]);

    ready.then(() => {
      if (done) return;
      frameRef.current = requestAnimationFrame(tick);
    });

    /* Any deliberate act dismisses it. Nobody should have to wait out an
       animation to read a page. */
    const skip = () => finish();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    window.addEventListener("wheel", skip, { passive: true });

    return () => {
      window.clearTimeout(ceiling);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("wheel", skip);
      finish();
    };
  }, []);

  /* aria-hidden and inert together: the overlay is decoration over a page that
     is already complete underneath it, so it must not be announced and must
     not take focus. The skip control is deliberately outside it, in the page,
     where a keyboard can reach it. */
  return (
    <div ref={hostRef} className="intro" aria-hidden="true" inert>
      <canvas ref={canvasRef} />
    </div>
  );
}

/* Runs before the first paint, which is the whole point of it being here
   rather than in the component: by the time React hydrates, the page has
   already been visible for a frame or two, and the brief was that the
   animation is the only thing on screen.

   It sets an attribute and nothing else. A reader with JavaScript off never
   gets the attribute, so they never get the overlay, and the page they see is
   the finished one. */
export function IntroBoot() {
  const source = `try{if(location.pathname==="/"&&!sessionStorage.getItem(${JSON.stringify(
    STORAGE_KEY,
  )})&&!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.dataset.intro="running"}}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: source }} />;
}
