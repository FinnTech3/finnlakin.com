/* The particle vocabulary, shared by the opening animation and the constellation
   behind the hero. It lived inside intro.tsx until the constellation needed the
   same triangles; two copies of this would drift, and the whole point of the
   brief was that the two are visibly made of the same thing.

   The steering and the sprite stamping are adapted from the code Finn supplied.
   Two things in it had to change before either could work, and both are load
   bearing enough to keep the note here rather than in a commit nobody reads:
   the steering vector is clamped rather than normalised, and movement is
   stepped by elapsed time rather than by frame. */

export type Vec = { x: number; y: number };

/* Small enough that two neighbouring samples do not merge. At nine pixels on a
   six pixel stride every triangle overlapped its neighbours, which thickened
   each stroke by ten pixels and closed the counters of the letters: a word came
   out as a bar rather than as text. */
export const TRIANGLE = 7;

export class Particle {
  pos: Vec = { x: 0, y: 0 };
  vel: Vec = { x: 0, y: 0 };
  target: Vec = { x: 0, y: 0 };
  /* Where this particle belongs when nothing is disturbing it. The intro never
     sets it, because its particles are always on their way somewhere. The
     constellation springs back to it. */
  home: Vec = { x: 0, y: 0 };
  maxSpeed = 5;
  maxForce = 0.25;
  closeEnough = 140;
  tint = 0;
  alpha = 0;
  scattered = false;
  /* Per-particle phase, so a field of them drifts out of step rather than
     pulsing together. */
  seed = 0;

  /* Accelerate towards the target, easing off inside a radius so particles
     settle instead of orbiting.

     `step` is the frame's length measured against sixty a second. The original
     advanced by a fixed amount per frame, which means the animation runs at
     whatever speed the machine happens to draw at. Measured here, the canvases
     together drop to thirty frames a second on a software rasteriser and twenty
     at the ninetieth percentile, so a word was still assembling when the next
     phase began. Stepping by time makes it take the same three seconds
     everywhere, and simply look coarser where the machine is slower. */
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

/* Just beyond the frame rather than a full canvas away. A phase then forms in
   about three quarters of a second; the first version spawned particles a
   diagonal out and was still gathering them when the next phase started. */
export function offscreenPoint(width: number, height: number): Vec {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.max(width, height) * 0.62;
  return {
    x: width / 2 + Math.cos(angle) * radius,
    y: height / 2 + Math.sin(angle) * radius,
  };
}

/* One sprite per palette colour, stroked once and stamped after that. Stroking
   a thousand paths a frame is what makes a canvas animation stutter in
   software; drawImage of a seven pixel bitmap does not. */
export function buildSprites(tints: string[], size = TRIANGLE): HTMLCanvasElement[] {
  return tints.map((tint) => {
    const sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const ctx = sprite.getContext("2d");
    if (!ctx) return sprite;
    const inset = size <= 5 ? 0.5 : 1;
    ctx.strokeStyle = tint;
    ctx.lineWidth = 1;
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.moveTo(size / 2, inset);
    ctx.lineTo(size - inset, size - inset);
    ctx.lineTo(inset, size - inset);
    ctx.closePath();
    ctx.stroke();
    return sprite;
  });
}

/* Reads tokens off :root so the particles and the type share one palette, and
   changing a value in globals.css changes both. The literals are what a browser
   that cannot resolve the variable gets.

   The caller names which tokens it wants. The overlay takes bone as well,
   because it sits opaque on top of everything; the constellation must not,
   because it sits in the background and a white particle behind a line of grey
   text was measured dropping the quietest colour on the site below AA. */
export function readTints(names: string[], fallbacks: string[]): string[] {
  try {
    const root = getComputedStyle(document.documentElement);
    return names.map((name, index) => {
      const value = root.getPropertyValue(name).trim();
      return /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallbacks[index]!;
    });
  } catch {
    /* A computed style can be unavailable in odd embedding contexts. The
       literals are correct answers, so there is nothing to report. */
    return fallbacks;
  }
}

/* Draw something to an offscreen canvas, then hand back the points it covered.
   This is the one piece worth sharing rather than copying: the intro draws a
   word with it and the constellation draws a shape, and neither has to know how
   the other turns ink into particles.

   The walk is properly two dimensional. Stepping through the flat RGBA array
   instead strides in x but visits every row, so it produces several times the
   particles it looks like it will, which is what the original did. */
export function samplePoints(
  width: number,
  height: number,
  stride: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Vec[] {
  const sheet = document.createElement("canvas");
  sheet.width = width;
  sheet.height = height;
  const ctx = sheet.getContext("2d");
  if (!ctx) return [];

  draw(ctx);

  const pixels = ctx.getImageData(0, 0, width, height).data;
  const points: Vec[] = [];
  for (let y = 0; y < height; y += stride) {
    const row = y * width;
    for (let x = 0; x < width; x += stride) {
      if (pixels[(row + x) * 4 + 3]! > 128) points.push({ x, y });
    }
  }
  return points;
}

/* Fisher-Yates. Shuffling the sample before particles are handed their targets
   is what makes a shape assemble all over at once rather than filling in
   raster order, which reads as a wipe. */
export function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
