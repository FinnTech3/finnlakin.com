import { inflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

/* Traces the brain's outline out of an anatomical plate, and writes it to
   src/particles/brain-profile.ts as a coordinate table.

   Three attempts were made at inventing this silhouette: a Fibonacci sphere
   displaced by sine waves, then a blend of ellipsoids and subtracted capsules.
   Both produced a smooth loaf. A brain's outline is not smooth. It is bumpy
   with gyri, the frontal pole bulges forward, the occipital comes to a blunt
   point, and the temporal lobe hangs as a distinct hook below a deep notch.
   Those are the features a person recognises and none of them survives being
   approximated by a quadric.

   The site this is modelled on does not invent it either: its manifest loads a
   floating point texture of positions baked from a sculpted model. Somebody
   drew that shape. This is the same answer reached without an artist, by
   tracing a figure that is out of copyright.

   Runs once, by hand, and commits its output. Nothing fetches at build time and
   nothing fetches at page load.

   Usage: npm run trace:brain

   The stages are: decode, separate figure from background by flooding the
   background in from the border, open the mask to shed the label text and the
   thin leader lines that touch the outline, take the largest connected
   component, walk its boundary, and simplify. */

/* Minimal decoder for a non interlaced 8 bit RGBA png. */
function decodePng(path: string) {
  const file = readFileSync(path);
  let at = 8;
  let width = 0, height = 0, colour = 0, depth = 0;
  const idat: Buffer[] = [];
  while (at < file.length) {
    const length = file.readUInt32BE(at);
    const type = file.toString("ascii", at + 4, at + 8);
    const data = file.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]!; colour = data[9]!;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  if (depth !== 8) throw new Error(`bit depth ${depth}`);
  const channels = colour === 6 ? 4 : colour === 2 ? 3 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[y * stride + i - channels]! : 0;
      const b = y > 0 ? out[(y - 1) * stride + i]! : 0;
      const c = i >= channels && y > 0 ? out[(y - 1) * stride + i - channels]! : 0;
      let v = line[i]!;
      if (filter === 1) v += a; else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1; else if (filter === 4) v += paeth(a, b, c);
      out[y * stride + i] = v & 0xff;
    }
  }
  return { width, height, channels, pixels: out };
}

const src = process.argv[2] ?? "scripts/reference/gray728-lateral-cerebrum.png";
const EPSILON = Number(process.argv[3] ?? 2.5);
const { width, height, channels, pixels } = decodePng(src);
console.log(`plate ${width}x${height}, ${channels} channels`);

/* 1. Near white and near transparent both count as background. */
const isBackground = new Uint8Array(width * height);
for (let i = 0; i < width * height; i++) {
  const r = pixels[i * channels]!, g = pixels[i * channels + 1]!, b = pixels[i * channels + 2]!;
  const a = channels === 4 ? pixels[i * channels + 3]! : 255;
  isBackground[i] = a < 40 || (r > 232 && g > 232 && b > 232) ? 1 : 0;
}

/* 2. Flood fill background from the border. White enclosed by an outline, such
      as the cerebellum, is not reached and so counts as figure. */
const outside = new Uint8Array(width * height);
const stack: number[] = [];
for (let x = 0; x < width; x++) { stack.push(x, x + (height - 1) * width); }
for (let y = 0; y < height; y++) { stack.push(y * width, width - 1 + y * width); }
while (stack.length) {
  const i = stack.pop()!;
  if (outside[i] || !isBackground[i]) continue;
  outside[i] = 1;
  const x = i % width, y = (i - x) / width;
  if (x > 0) stack.push(i - 1);
  if (x < width - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - width);
  if (y < height - 1) stack.push(i + width);
}

let figure = new Uint8Array(width * height);
for (let i = 0; i < width * height; i++) figure[i] = outside[i] ? 0 : 1;

/* 3. Opening, to shed the label text and the thin leader lines that touch the
      outline. Erode then dilate by the same radius leaves the mass unchanged
      and removes anything thinner than the kernel. */
function morph(mask: Uint8Array, radius: number, erode: boolean) {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = erode ? 1 : 0;
      for (let dy = -radius; dy <= radius && hit === (erode ? 1 : 0); dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy;
          const v = nx < 0 || ny < 0 || nx >= width || ny >= height ? 0 : mask[ny * width + nx]!;
          if (erode ? v === 0 : v === 1) { hit = erode ? 0 : 1; break; }
        }
      }
      out[y * width + x] = hit;
    }
  }
  return out;
}
figure = morph(morph(figure, 4, true), 4, false);

/* 4. Largest connected component. */
const label = new Int32Array(width * height).fill(-1);
let best = -1, bestSize = 0, next = 0;
for (let seed = 0; seed < width * height; seed++) {
  if (!figure[seed] || label[seed] >= 0) continue;
  const id = next++; let size = 0; const queue = [seed];
  while (queue.length) {
    const i = queue.pop()!;
    if (label[i] >= 0 || !figure[i]) continue;
    label[i] = id; size++;
    const x = i % width, y = (i - x) / width;
    if (x > 0) queue.push(i - 1);
    if (x < width - 1) queue.push(i + 1);
    if (y > 0) queue.push(i - width);
    if (y < height - 1) queue.push(i + width);
  }
  if (size > bestSize) { bestSize = size; best = id; }
}
console.log(`components ${next}, largest ${bestSize} px (${((bestSize / (width * height)) * 100).toFixed(1)}% of the plate)`);

const body = new Uint8Array(width * height);
for (let i = 0; i < width * height; i++) body[i] = label[i] === best ? 1 : 0;

/* 5. Moore neighbourhood contour walk, clockwise from the topmost pixel. */
function contour(mask: Uint8Array) {
  let start = -1;
  for (let i = 0; i < width * height && start < 0; i++) if (mask[i]) start = i;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : mask[y * width + x]!);
  const dirs = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  const sx = start % width, sy = (start - (start % width)) / width;
  const points: [number, number][] = [];
  let cx = sx, cy = sy, dir = 6;
  for (let guard = 0; guard < width * height * 8; guard++) {
    points.push([cx, cy]);
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8;
      const nx = cx + dirs[d]![0]!, ny = cy + dirs[d]![1]!;
      if (at(nx, ny)) { cx = nx; cy = ny; dir = d; moved = true; break; }
    }
    if (!moved) break;
    if (cx === sx && cy === sy && points.length > 8) break;
  }
  return points;
}
const walk = contour(body);
console.log(`contour ${walk.length} points`);

/* 6. Ramer Douglas Peucker. */
function simplify(points: [number, number][], epsilon: number): [number, number][] {
  if (points.length < 3) return points;
  let index = 0, far = 0;
  const [ax, ay] = points[0]!; const [bx, by] = points[points.length - 1]!;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i]!;
    const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
    if (d > far) { far = d; index = i; }
  }
  if (far <= epsilon) return [points[0]!, points[points.length - 1]!];
  return [...simplify(points.slice(0, index + 1), epsilon).slice(0, -1), ...simplify(points.slice(index), epsilon)];
}
for (const eps of [1.5, 2.5, 4]) {
  console.log(`  epsilon ${eps}: ${simplify(walk, eps).length} points`);
}

/* Into the model units the distance field works in: half length one, origin at
   the middle of the bounding box, y up rather than down, and the frontal pole
   towards negative x, which is the way the plate is drawn and the way the cloud
   sits beside a headline. */
const simplified = simplify(walk, EPSILON);
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const [x, y] of simplified) {
  minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const scale = 2 / (maxX - minX);
const centreX = (minX + maxX) / 2;
const centreY = (minY + maxY) / 2;
const model = simplified.map(([x, y]) => [
  Number(((x - centreX) * scale).toFixed(4)),
  Number((-(y - centreY) * scale).toFixed(4)),
]);

const table = model.map(([x, y]) => `  [${x}, ${y}],`).join("\n");
writeFileSync(
  "src/particles/brain-profile.ts",
  `/* The brain's outline, traced from an anatomical plate.

   Generated by scripts/trace-brain-outline.ts from
   scripts/reference/gray728-lateral-cerebrum.png, which is plate 728 of Gray's
   Anatomy, 1918, and public domain. Do not edit by hand: run npm run trace:brain.

   Model units, matching brain-anatomy.ts: half length one, origin at the middle
   of the outline's bounding box, y up, and the frontal pole towards negative x.

   ${model.length} points, simplified from a ${walk.length} point boundary walk at
   an epsilon of ${EPSILON} plate pixels. */
export const BRAIN_PROFILE: readonly (readonly [number, number])[] = [
${table}
] as const;

/* How tall the outline is against its length, so the field does not have to
   recompute it. */
export const PROFILE_HALF_HEIGHT = ${Number((((maxY - minY) / 2) * scale).toFixed(4))};
`,
);
console.log(`wrote src/particles/brain-profile.ts: ${model.length} points, half height ${(((maxY - minY) / 2) * scale).toFixed(3)}`);
