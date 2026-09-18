import {
  BOKEH_APERTURE,
  BOKEH_FOCAL_DEPTH,
  BOKEH_RINGS,
  BOKEH_SAMPLES,
} from "../src/particles/post";
import { CAMERA_FAR, CAMERA_NEAR, CAMERA_POSITION } from "../src/particles/renderer";
import { brain } from "../src/particles/brain-shape";
import { SEED } from "../src/particles/targets";
import { INITIAL_YAW } from "../src/particles/timeline";
import { DEFAULTS } from "../src/particles/types";

/* Proves the depth of field separates the near surface of the cloud from the
   far one, which is the whole reason it is there.

   The near and far halves of the brain project onto the same pixels, so there
   is no way to measure this by splitting a rendered frame in two. What can be
   measured, and is, is the circle of confusion the shader computes at each end
   of the cloud: the same arithmetic the fragment shader runs, over the depths
   the generator and the timeline actually produce.

   It exists because the constants were wrong for the whole life of the effect
   and nothing caught it. The depth pass writes a linear depth between the clip
   planes; the focal depth was 0.125, which is a plane 3.84 world units from a
   camera that sits ten units back, about six units in front of the nearest
   particle. Every particle was outside the focal plane by more than the clamp,
   so the entire cloud rendered at maximum defocus, near and far alike, and two
   different apertures produced pixel for pixel the same image. The number that
   was obviously suspicious was the aperture, and it was not the aperture. */

const GRID = DEFAULTS.gridSize;
const COUNT = GRID * GRID;

let failures = 0;
function check(condition: boolean, description: string, detail = "") {
  if (condition) return;
  failures += 1;
  console.error(`  FAIL  ${description}${detail ? `: ${detail}` : ""}`);
}

/* The vertex shader's transform, for the opening composition: the position
   texture is unpacked about its centre and scaled by the factor, the field is
   turned by the timeline's rotation, and the camera looks down the z axis from
   its resting place. Only the z component matters here. */
const factor = DEFAULTS.factorDesktop;
const { shape } = brain(COUNT, SEED);
const cos = Math.cos(INITIAL_YAW);
const sin = Math.sin(INITIAL_YAW);
const cameraZ = CAMERA_POSITION[2];

const depths: number[] = [];
for (let i = 0; i < COUNT; i++) {
  const px = (shape[i * 3]! - 0.5) * 2 * factor;
  const pz = (shape[i * 3 + 2]! - 0.5) * 2 * factor;
  const worldZ = -sin * px + cos * pz;
  const view = cameraZ - worldZ;
  depths.push(Math.min(1, Math.max(0, (view - CAMERA_NEAR) / (CAMERA_FAR - CAMERA_NEAR))));
}
depths.sort((a, b) => a - b);
const at = (quantile: number) => depths[Math.floor(quantile * (depths.length - 1))]!;

/* The fragment shader's own line, with the same scale its uniform is uploaded
   with and the same clamp. */
const aperture = BOKEH_APERTURE * 900000;
const BLUR_TEXELS = 40;
function confusion(depth: number) {
  return Math.min(1, Math.max(0, Math.abs(depth - BOKEH_FOCAL_DEPTH) * aperture));
}
function blur(depth: number) {
  return confusion(depth) * BLUR_TEXELS;
}

/* The nearest and furthest fiftieth are ignored: those are the strays, and a
   single speck should not set where the focal plane goes. */
const near = at(0.02);
const far = at(0.98);

console.log("Depth of field");
console.log(
  `  the cloud runs from ${at(0).toFixed(4)} to ${at(1).toFixed(4)} in depth, ` +
    `${((at(1) - at(0)) * (CAMERA_FAR - CAMERA_NEAR)).toFixed(2)} world units`,
);
console.log(
  `  focal plane ${BOKEH_FOCAL_DEPTH}, near surface ${near.toFixed(4)}, far surface ${far.toFixed(4)}`,
);
console.log(
  `  defocus: near ${blur(near).toFixed(1)} texels, median ${blur(at(0.5)).toFixed(1)}, ` +
    `far ${blur(far).toFixed(1)}`,
);

check(
  blur(near) < 2,
  "the near surface is in focus",
  `${blur(near).toFixed(1)} texels of defocus on it`,
);
check(
  blur(far) > 6,
  "the far surface is defocused enough to stop competing with the near one",
  `${blur(far).toFixed(1)} texels`,
);
check(
  blur(far) - blur(near) > 5,
  "there is a real gap between the two surfaces",
  `${(blur(far) - blur(near)).toFixed(1)} texels`,
);

/* The clamp is the trap. Once two depths both saturate, the aperture stops
   doing anything and no amount of turning it up changes the image. */
const saturated = depths.filter((depth) => confusion(depth) >= 1).length;
check(
  saturated === 0,
  "no part of the cloud is at the clamp, where the aperture stops meaning anything",
  `${((saturated / depths.length) * 100).toFixed(1)}% saturated`,
);

/* And the blur has to be sampled densely enough to read as a blur. The ring
   sampler takes one tap at the centre and the rest spread over the widest
   ring, so at the far surface the gap between neighbouring taps is what decides
   whether a speck turns into a soft disc or into a handful of copies of
   itself. */
const taps = 1 + BOKEH_RINGS * BOKEH_SAMPLES;
const spacing = (2 * Math.PI * blur(far)) / BOKEH_SAMPLES;
console.log(`  ${taps} taps, ${spacing.toFixed(1)} texels between them on the outer ring`);
check(
  spacing < 12,
  "the outer ring is sampled closely enough to read as a blur rather than as copies",
  `${spacing.toFixed(1)} texels apart`,
);

if (failures > 0) {
  console.error(`\nDepth of field: ${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("  all depth of field checks passed");
