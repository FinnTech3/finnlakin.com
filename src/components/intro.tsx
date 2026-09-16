"use client";

import { useEffect, useRef } from "react";

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

/* Sampling stride through the rendered text, in buffer pixels. Six lands
   between nine hundred and fourteen hundred particles at every viewport this
   site sees, which is enough for a glyph to read and few enough to draw in
   software. */
const STRIDE = 6;

/* Small enough that two neighbouring samples do not merge. At nine pixels on a
   six pixel stride every triangle overlapped its neighbours, which thickened
   each stroke by ten pixels and closed the counters of the letters: the word
   came out as a bar rather than as text. */
const TRIANGLE = 7;

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

type Vec = { x: number; y: number };

class Particle {
  pos: Vec = { x: 0, y: 0 };
  vel: Vec = { x: 0, y: 0 };
  target: Vec = { x: 0, y: 0 };
  maxSpeed = 5;
  maxForce = 0.25;
  closeEnough = 140;
  tint = 0;
  alpha = 0;
  scattered = false;

  /* Finn's steering: accelerate towards the target, ease off inside a radius so
     particles settle instead of orbiting.

     What is new is `step`, the frame's length measured against sixty a second.
     The original advanced by a fixed amount per frame, which means the
     animation runs at whatever speed the machine happens to draw at. Measured
     here, the two canvases together drop to thirty frames a second on a
     software rasteriser and twenty at the ninetieth percentile, so the word was
     still assembling when the next phase began. Stepping by time rather than by
     frame makes the intro take the same three seconds everywhere, and simply
     look coarser where the machine is slower. */
  move(step: number) {
    const dx = this.target.x - this.pos.x;
    const dy = this.target.y - this.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const proximity = distance < this.closeEnough ? distance / this.closeEnough : 1;

    let desiredX = 0;
    let desiredY = 0;
    if (distance > 0) {
      desiredX = (dx / distance) * this.maxSpeed * proximity;
      desiredY = (dy / distance) * this.maxSpeed * proximity;
    }

    /* Clamped to maxForce, not set to it. The original normalised this vector
       unconditionally, so a particle sitting on its target still received a
       full strength correction every frame and jittered around it forever. At a
       fixed sixty frames a second that reads as a slight shimmer and looks
       deliberate. Stepped by elapsed time it is not slight: the correction
       scales with the frame length and the cloud never resolves into letters at
       all, which is what a screenshot of it showed. */
    let steerX = desiredX - this.vel.x;
    let steerY = desiredY - this.vel.y;
    const steer = Math.sqrt(steerX * steerX + steerY * steerY);
    if (steer > this.maxForce) {
      steerX = (steerX / steer) * this.maxForce;
      steerY = (steerY / steer) * this.maxForce;
    }

    this.vel.x += steerX * step;
    this.vel.y += steerY * step;
    this.pos.x += this.vel.x * step;
    this.pos.y += this.vel.y * step;

    if (this.alpha < 1) this.alpha = Math.min(1, this.alpha + 0.09 * step);
  }
}

/* Just beyond the frame rather than a full canvas away. Paired with the speeds
   below, a phase forms in about three quarters of a second; the first version
   spawned particles a diagonal out and was still gathering them when the next
   phase started. */
function offscreenPoint(width: number, height: number): Vec {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.max(width, height) * 0.62;
  return {
    x: width / 2 + Math.cos(angle) * radius,
    y: height / 2 + Math.sin(angle) * radius,
  };
}

/* One sprite per palette colour, stroked once and stamped after that. Stroking
   a thousand paths a frame is what makes a canvas animation stutter in
   software; drawImage of a ten pixel bitmap does not. */
function buildSprites(tints: string[]): HTMLCanvasElement[] {
  return tints.map((tint) => {
    const sprite = document.createElement("canvas");
    sprite.width = TRIANGLE;
    sprite.height = TRIANGLE;
    const ctx = sprite.getContext("2d");
    if (!ctx) return sprite;
    const inset = 1;
    ctx.strokeStyle = tint;
    ctx.lineWidth = 1;
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.moveTo(TRIANGLE / 2, inset);
    ctx.lineTo(TRIANGLE - inset, TRIANGLE - inset);
    ctx.lineTo(inset, TRIANGLE - inset);
    ctx.closePath();
    ctx.stroke();
    return sprite;
  });
}

function readTints(): string[] {
  const fallbacks = ["#8052ff", "#ffb829", "#15846e", "#ffffff"];
  try {
    const root = getComputedStyle(document.documentElement);
    const resolved = ["--iris", "--spark", "--verdant", "--bone"].map((name, index) => {
      const value = root.getPropertyValue(name).trim();
      return /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallbacks[index]!;
    });
    return resolved;
  } catch {
    return fallbacks;
  }
}

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
    const tints = readTints();
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

    /* Renders a phase to an offscreen canvas, reads back the pixels it covered
       and hands each one to a particle. Sampling is a proper two dimensional
       walk: the original stepped through the flat RGBA array, which strides in
       x but visits every row, so it produced several times the particles it
       looked like it would. */
    function retarget(lines: string[]) {
      const sheet = document.createElement("canvas");
      sheet.width = width;
      sheet.height = height;
      const paint = sheet.getContext("2d");
      if (!paint) return;

      const family = getComputedStyle(document.body).fontFamily || "sans-serif";
      const longest = lines.reduce((a, b) => (a.length > b.length ? a : b));
      let size = Math.round(height / (lines.length * 1.5 + 0.5));
      paint.font = `600 ${size}px ${family}`;
      const measured = paint.measureText(longest).width;
      const limit = width * 0.9;
      if (measured > limit) size = Math.max(16, Math.floor((size * limit) / measured));

      /* Weight 600, where the page sets its display type at 400. A headline at
         a hundred points can afford a light stroke; the same letterform sampled
         at a sixth of that size and stamped with a triangle every six pixels
         cannot. */
      paint.font = `600 ${size}px ${family}`;
      paint.fillStyle = "#ffffff";
      paint.textAlign = "center";
      paint.textBaseline = "middle";
      const leading = size * 1.14;
      const top = height / 2 - ((lines.length - 1) * leading) / 2;
      lines.forEach((line, index) => {
        paint.fillText(line, width / 2, top + index * leading);
      });

      const pixels = paint.getImageData(0, 0, width, height).data;
      const spots: Vec[] = [];
      for (let y = 0; y < height; y += STRIDE) {
        const row = y * width;
        for (let x = 0; x < width; x += STRIDE) {
          if (pixels[(row + x) * 4 + 3]! > 128) spots.push({ x, y });
        }
      }

      for (let i = spots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [spots[i], spots[j]] = [spots[j]!, spots[i]!];
      }

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
        for (const particle of particles) {
          particle.scattered = true;
          particle.target = offscreenPoint(width, height);
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
