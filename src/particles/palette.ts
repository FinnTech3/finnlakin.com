/* The particle palette, in one file, because it is the thing most likely to be
   re-tuned and the last thing that should need a search across shaders to
   change.

   Icy, from the reference Finn sent: a near black ground, a cobalt bulk, azure
   and cornflower through the middle, pale ice and white at the highlights, and
   a sparse warm cream in the brightest core. The cream is about a twentieth of
   the particles and it is not decoration: it is the one thread back to the
   site's amber accent, without which the cloud reads as a foreign object
   dropped onto somebody else's page.

   These are linear values. Everything in the render chain works in linear and
   converts once, in the final pass, so a colour written here must not be
   gamma encoded or the bloom will find the wrong pixels. */

export type Rgb = [number, number, number];

function srgbToLinear(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

export function hexToLinear(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return [
    srgbToLinear(Number.parseInt(full.slice(0, 2), 16) / 255),
    srgbToLinear(Number.parseInt(full.slice(2, 4), 16) / 255),
    srgbToLinear(Number.parseInt(full.slice(4, 6), 16) / 255),
  ];
}

/* The ramp, darkest to brightest. A particle picks a position along this rather
   than one of six fixed colours, so neighbouring particles differ slightly and
   the cloud has depth in its colour as well as in its geometry. */
export const RAMP = ["#12275c", "#1b3f9e", "#2f6bdc", "#6ea3f2", "#cfe3ff", "#ffffff"] as const;

/* Sparse, and deliberately off the ramp. Roughly one particle in twenty. */
export const WARM = "#e3d3a8";
export const WARM_SHARE = 0.05;

/* The page behind it. Matches the near black of the reference rather than pure
   black, which is what stops the darkest particles disappearing into the
   background entirely. */
export const GROUND = "#0a0d14";

export function sampleRamp(t: number): Rgb {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const scaled = clamped * (RAMP.length - 1);
  const low = Math.floor(scaled);
  const high = Math.min(RAMP.length - 1, low + 1);
  const blend = scaled - low;

  const a = hexToLinear(RAMP[low]!);
  const b = hexToLinear(RAMP[high]!);
  return [
    a[0] + (b[0] - a[0]) * blend,
    a[1] + (b[1] - a[1]) * blend,
    a[2] + (b[2] - a[2]) * blend,
  ];
}
