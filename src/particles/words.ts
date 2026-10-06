import { mulberry32 } from "./pack";
import type { Shape } from "./shapes";

/* Words, as particle targets.

   The opening animation used to be a separate two dimensional canvas with its
   own particle system, its own loop and its own compositing problems. It is now
   two more entries in the same four quadrant target texture the brain lives in,
   which means the words are made of the identical ten thousand pyramids, lit
   the same way, and become the brain by the same morph that carries every other
   transition on the page. That was the original brief, and doing it this way
   also disposes of the failure that stopped the old one: additive compositing
   on a flat canvas saturates to a white blob the moment particles overlap, and
   there is no wash value that fixes it.

   Text is measured and drawn on an offscreen canvas, the covered pixels are
   sampled, and those become positions. Sizing is in canvas pixels, so the rules
   Finn tuned by looking at it survive unchanged: the block occupies the middle
   third of the screen, and a narrow screen is allowed most of its width where a
   wide one is not. */

/* The camera's half height at the depth the particles sit at, which is fixed by
   the field of view and the camera distance. Everything here is expressed
   against it so that a word lands where it was measured to land. */
const WORLD_HALF_HEIGHT = 10 * Math.tan((50 * Math.PI) / 360);

/* Sampling stride through the rendered text, in canvas pixels.

   One, not four. The old two dimensional intro used four because its particles
   were seven pixel triangles and a tighter stride made neighbouring ones
   overlap until the counters of the letters closed up. These particles are
   about two pixels, and there are ten thousand of them against a fixed word, so
   the arithmetic runs the other way: at a stride of four, "FINN LAKIN" sampled
   to six hundred and sixteen points, which is sixteen pyramids stacked on every
   pixel of the type. That is not a word, it is a bar, and that is exactly what
   it looked like. */
const STRIDE = 1;

/* The canvas the text is measured on. Capped, because the sample count is what
   costs, not the resolution. */
const MAX_EDGE = 1100;

export function introFactor(aspect: number) {
  /* Normalised x then maps one to one onto the viewport's width, so a word
     measured to fill four tenths of the canvas fills four tenths of the screen. */
  return WORLD_HALF_HEIGHT * aspect;
}

/* The face the words are drawn in, and it is the page's own headline's.

   They were drawn in the body's face, which on this site is a wide small
   monospace and was the right face for a paragraph and the wrong one for a name
   set at the size of the screen. The name is already on the page in its
   headline face, enormous, under the veil, and the opening is the same name
   arriving: it should be recognisably the same letters. So the face is read off
   the first heading in the document instead of being named here, which keeps
   this file ignorant of which fonts the site loads, and means a change of
   typeface on the page is a change of typeface in the opening.

   The canvas can only draw with a face that has arrived. A face still in flight
   falls back silently to whatever the machine has, which is why the component
   that creates the engine waits for it first. */
export function displayFace(): { family: string; weight: string } {
  const style = getComputedStyle(document.querySelector("h1") ?? document.body);
  return { family: style.fontFamily || "sans-serif", weight: style.fontWeight || "600" };
}

/* One line of text, or several, as a shape.

   Every particle gets a target, which matters: a word drawn with fewer points
   than there are particles would leave the rest stranded wherever they were,
   and a word drawn with more would drop some of it. Points are cycled with a
   little jitter, so a short word is drawn with several particles per sample
   rather than a tenth of the cloud. */
export function wordShape(
  lines: string[],
  viewportWidth: number,
  viewportHeight: number,
  count: number,
  seed: number,
): Shape {
  const random = mulberry32(seed);
  const out = new Float32Array(count * 3);

  const scale = Math.min(1, MAX_EDGE / Math.max(viewportWidth, viewportHeight));
  const width = Math.max(2, Math.round(viewportWidth * scale));
  const height = Math.max(2, Math.round(viewportHeight * scale));
  const aspect = width / height;

  const sheet = document.createElement("canvas");
  sheet.width = width;
  sheet.height = height;
  const ctx = sheet.getContext("2d");
  if (!ctx) return out;

  const face = displayFace();
  const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), "");

  /* The middle third, and no wider than a share of the screen that depends on
     how narrow the screen is. A phone gets most of its width because it has
     little to spare; a monitor does not, because a headline running the whole
     way across a wide screen stops reading as a headline. */
  const narrow = width < height;
  const widthShare = narrow ? 0.82 : 0.38;
  let size = Math.floor(height / 3 / (lines.length * 1.18));
  ctx.font = `${face.weight} ${size}px ${face.family}`;
  const measured = ctx.measureText(longest).width;
  const limit = width * widthShare;
  if (measured > limit) size = Math.floor((size * limit) / measured);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${face.weight} ${size}px ${face.family}`;

  const leading = size * 1.18;
  const top = height / 2 - ((lines.length - 1) * leading) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, top + index * leading);
  });

  const pixels = ctx.getImageData(0, 0, width, height).data;
  const points: [number, number][] = [];
  for (let y = 0; y < height; y += STRIDE) {
    const row = y * width;
    for (let x = 0; x < width; x += STRIDE) {
      if (pixels[(row + x) * 4 + 3]! > 128) points.push([x, y]);
    }
  }

  if (points.length === 0) {
    for (let i = 0; i < count * 3; i++) out[i] = 0.5;
    return out;
  }

  /* Shuffled, so that a word assembles all over at once rather than filling in
     raster order, which reads as a wipe. */
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = points[i]!;
    points[i] = points[j]!;
    points[j] = swap;
  }

  for (let i = 0; i < count; i++) {
    const [px, py] = points[i % points.length]!;
    const jitter = 1;
    const fx = (px + (random() - 0.5) * jitter) / width - 0.5;
    const fy = 0.5 - (py + (random() - 0.5) * jitter) / height;

    out[i * 3] = 0.5 + fx;
    out[i * 3 + 1] = 0.5 + fy / aspect;
    /* A shallow slab rather than a plane. Flat, the pyramids all catch the
       light identically and the word reads as a printed texture; given a little
       depth they read as objects arranged into a word. */
    out[i * 3 + 2] = 0.5 + (random() - 0.5) * 0.02;
  }

  return out;
}
