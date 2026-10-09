/* The finishing chain.

   Every pass here is a full screen triangle over a framebuffer, and the order
   is: pull out what is bright, blur it at five scales, add it back, blur what
   is out of focus, then tone map, darken the corners, add grain and convert to
   the colour space the screen wants.

   The tone map is not decoration. The particles accumulate additively into a
   half float target, which is the only way to draw ten thousand overlapping
   shards without sorting them, and additive accumulation goes past one in the
   dense middle of the cloud. Written straight to the screen that clips to a
   flat white blob, which is exactly how this effect failed when it was tried on
   a two dimensional canvas. Tone mapped, the same values roll off towards white
   instead of being truncated at it, and the dense middle reads as bright rather
   than as blown out. */

/* Anything above the threshold, scaled by how far above it sits, so a particle
   just over the line contributes almost nothing and the bloom has no visible
   edge where it begins. */
export const BRIGHT_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D t_source;
uniform float u_threshold;

void main() {
  vec3 colour = texture(t_source, v_uv).rgb;
  float luminance = dot(colour, vec3(0.2126, 0.7152, 0.0722));
  float contribution = max(luminance - u_threshold, 0.0);
  float weight = luminance > 0.0001 ? contribution / luminance : 0.0;
  fragColor = vec4(colour * weight, 1.0);
}
`;

/* Separable Gaussian. Run twice per level, horizontally then vertically, which
   turns a two dimensional kernel into two one dimensional ones: nine taps each
   way instead of eighty one. */
export const BLUR_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D t_source;
uniform vec2 u_direction;
uniform float u_radius;

void main() {
  float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  vec3 sum = texture(t_source, v_uv).rgb * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 step = u_direction * float(i) * u_radius;
    sum += texture(t_source, v_uv + step).rgb * weights[i];
    sum += texture(t_source, v_uv - step).rgb * weights[i];
  }
  fragColor = vec4(sum, 1.0);
}
`;

/* Five blurred copies at halving resolutions, summed with falling weights. The
   wide levels give the broad halo and the tight ones the close glow; either
   alone reads as a mistake. */
export const BLOOM_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D t_scene;
uniform sampler2D t_level0;
uniform sampler2D t_level1;
uniform sampler2D t_level2;
uniform sampler2D t_level3;
uniform sampler2D t_level4;
uniform float u_strength;

void main() {
  vec3 scene = texture(t_scene, v_uv).rgb;

  /* The weights sum to one. Unnormalised they summed to three and an eighth, so
     a strength of four tenths was really one and a quarter, the pyramids
     dissolved into their own halo and the bloom stopped being a finishing layer
     and became the effect. */
  vec3 bloom =
    texture(t_level0, v_uv).rgb * 0.3175 +
    texture(t_level1, v_uv).rgb * 0.2540 +
    texture(t_level2, v_uv).rgb * 0.1905 +
    texture(t_level3, v_uv).rgb * 0.1429 +
    texture(t_level4, v_uv).rgb * 0.0951;

  fragColor = vec4(scene + bloom * u_strength, 1.0);
}
`;

/* Depth of field. The circle of confusion comes from how far a pixel's depth is
   from the focal plane, and the blur is a spiral of taps scaled by it.

   Deliberately restrained. The specification is explicit that this must create
   depth separation rather than blur the brain, and an aperture that reads as
   dramatic in a still photograph reads as a smeared background in something
   that moves. */
export const BOKEH_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D t_source;
uniform sampler2D t_depth;
uniform vec2 u_texel;
uniform float u_focalDepth;
uniform float u_aperture;
uniform float u_rings;
uniform float u_samples;

void main() {
  float depth = texture(t_depth, v_uv).r;
  /* Nothing was drawn here, so there is nothing to defocus. Without this the
     empty background borrows colour from the particles at its edge and the
     cloud grows a halo that is not the bloom. */
  if (depth <= 0.0001) {
    fragColor = texture(t_source, v_uv);
    return;
  }

  float confusion = clamp(abs(depth - u_focalDepth) * u_aperture, 0.0, 1.0);
  vec3 sum = texture(t_source, v_uv).rgb;
  float weight = 1.0;

  for (float ring = 1.0; ring <= 4.0; ring += 1.0) {
    if (ring > u_rings) break;
    float scale = ring / u_rings;
    for (float s = 0.0; s < 6.0; s += 1.0) {
      if (s >= u_samples) break;
      float angle = (s / u_samples) * 6.2831853 + ring * 0.7;
      vec2 offset = vec2(cos(angle), sin(angle)) * u_texel * confusion * scale * 40.0;
      sum += texture(t_source, v_uv + offset).rgb;
      weight += 1.0;
    }
  }

  fragColor = vec4(sum / weight, 1.0);
}
`;

/* The last pass: tone map, vignette, grain, and the conversion out of linear.
   All four together, because each one is a handful of instructions and four
   separate full screen passes to do them would cost four times the bandwidth
   for no benefit. */
export const FINAL_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D t_source;
uniform float u_time;
uniform float u_vignetteOffset;
uniform float u_vignetteDarkness;
uniform float u_grain;
uniform float u_exposure;
/* The keep-out. The cloud is drawn everywhere the page's words are not, and
   these say where that is, in the same screen space the page is laid out in.

   The screen is split at up to two heights, u_splits, where the lane changes
   between two sections, and u_sides is the column in each region top to
   bottom: +1 the right of the screen, -1 the left, 0 none. The column starts
   u_laneInner from the middle of the screen. u_gapCentre and u_gapHalf are the
   strip between two sections, which is the only horizontal road across the
   page that has no text on it. */
uniform vec2 u_splits;
uniform vec3 u_sides;
uniform float u_splitSoft;
uniform float u_laneInner;
uniform float u_maskFeather;
uniform float u_gapCentre;
uniform float u_gapHalf;
uniform float u_gapSoft;
uniform float u_maskOff;

/* Which medium the cloud is drawn in: 0 light, 1 ink, 2 two inks.

   Light is the original reading and the only one that suits a dark page: the
   particles accumulate additively, so the canvas carries light and the page
   behind it supplies the dark. Over a light page that reading adds to white
   and disappears, which is why the other two exist. They read the same
   accumulation as how much ink has been laid down, and lay it.

   Everything below is in display space, not linear. These are the colours of a
   pigment and a sheet of paper as a reader sees them, so they are written the
   way they are picked, and encode() is for the light path only. */
uniform float u_surface;
/* One ink: pale where the laydown is thin, deep where it is heavy, reached at
   the rate u_inkGain. Chalk on a grey page is this with light pigments. */
uniform vec3 u_inkPale;
uniform vec3 u_inkDeep;
uniform float u_inkGain;
/* Two inks: the sheet they are printed on, one colour each, how far the second
   plate is out of register, and how coarse the screen is. The paper is needed
   because two inks over one another are filters rather than lights, and what
   the second filters is the first over the sheet. The mask guarantees the
   cloud only ever reaches bare sheet, so this is the real backdrop and not an
   approximation of one. */
uniform vec3 u_paper;
uniform vec3 u_inkA;
uniform vec3 u_inkB;
uniform vec2 u_misregister;
uniform float u_screenCell;
uniform float u_screenDepth;

float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

/* A halftone screen: a grid of dots at an angle, as a number from nought to
   one. Two plates at the same angle would moire against each other, so each
   gets its own, the way a press does. */
float screenAt(vec2 frag, float angle, float cell) {
  float s = sin(angle);
  float c = cos(angle);
  vec2 turned = mat2(c, -s, s, c) * frag / max(cell, 1.0);
  return (sin(turned.x * 6.2831853) * sin(turned.y * 6.2831853)) * 0.5 + 0.5;
}

/* How much ink a given density of light lays down, saturating: the first
   particles darken the sheet quickly and the hundredth in the same place adds
   almost nothing, which is what ink does and light does not. */
float laydown(float mass, float gain) {
  return 1.0 - exp(-max(mass, 0.0) * gain);
}

float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

/* Linear to sRGB. Out of linear once, here: doing it earlier would have the
   bloom looking for bright pixels in the wrong space. */
vec3 encode(vec3 linear) {
  return mix(
    linear * 12.92,
    1.055 * pow(max(linear, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), linear)
  );
}

/* A filmic curve. Values under about one are barely changed; values well over
   it are pulled back towards white rather than clipped at it. */
vec3 tonemap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 colour = tonemap(texture(t_source, v_uv).rgb * u_exposure);

  /* A vignette is a light going off at the edges of a frame, so it belongs to
     the light reading and to nothing else. On a printed sheet the same term
     would mean less ink towards the edges of the page, which is not a thing
     that happens. */
  if (u_surface < 0.5) {
    vec2 offset = (v_uv - 0.5) * u_vignetteOffset;
    colour = mix(colour, vec3(0.0), clamp(dot(offset, offset) * u_vignetteDarkness, 0.0, 1.0));
  }

  /* Cut the cloud to the room it is allowed, and do it here, after the bloom
     has already been composited in.

     This replaces a gradient that was painted over the reading column in CSS.
     That gradient worked, in the sense that the contrast measurement passed,
     and it was the wrong instrument: it dimmed the cloud on whichever side the
     words were, so the brain visibly lost half its brightness every time it
     changed lanes. The complaint was that it goes dim on the left. It did.

     A mask is the honest version of the same requirement. The light does not
     cross into the column, so the column needs no shade, so both sides of the
     page run the cloud at the same brightness. The bloom is inside this cut
     rather than outside it, which is the part a shade could never do: the
     bloom runs five downsample levels past the last particle, and before this
     it reached across any lane wide enough to put a paragraph in.

     The ramp is one sided. It runs from the boundary *into* the cloud's own
     column, never out of it, so a feather that softens the edge cannot also
     leak light onto a word. */
  float side = v_uv.y > u_splits.x ? u_sides.x : (v_uv.y > u_splits.y ? u_sides.y : u_sides.z);
  float edge = 0.5 + side * u_laneInner;
  float keep = side == 0.0
    ? 0.0
    : smoothstep(0.0, u_maskFeather, (v_uv.x - edge) * side);

  /* Faded to nothing towards a split, from both sides, across the seam's clear
     half: the split is where one section's column hands over to the next's,
     and a hard line there sliced straight through a dispersed cloud. The fade
     lies inside the seam, which has no text in it. */
  if (u_splitSoft > 0.0) {
    float nearest = min(abs(v_uv.y - u_splits.x), abs(v_uv.y - u_splits.y));
    keep *= smoothstep(0.0, u_splitSoft, nearest);
  }

  /* And the road across. While the cloud is changing sides it is not in either
     column, it is in the gap between two sections, which is the one band of the
     page with no text in it. The strip is nought height when it is not
     crossing, so this term contributes nothing the rest of the time.

     On a screen too narrow for a column the same strip is the cloud's whole
     space: the empty slot under the hero's controls, with no column at all. */
  if (u_gapHalf > 0.0) {
    float toEdge = abs(v_uv.y - u_gapCentre);
    keep = max(keep, 1.0 - smoothstep(u_gapHalf * (1.0 - u_gapSoft), u_gapHalf, toEdge));
  }

  /* And the escape, for every case with no column to keep out of: a phone
     before the cloud has anywhere to be, a reduced motion frame, the routes
     that mount the canvas without the page that shapes it. One uniform rather
     than a sentinel inside another, because a mask that silently means "all of
     it" when a number happens to be nought is the kind of thing that ships
     inverted. */
  keep = max(keep, u_maskOff);

  /* Ink, on one plate or two.

     Both readings obey the keep-out exactly as the light one does: the laydown
     is multiplied by it, and every term after that is proportional to the
     laydown, so a pixel the mask excludes carries no ink, no screen and no
     grain. That is not a detail. The canvas covers the whole page, so anything
     with an alpha above nought here is a mark on somebody's paragraph. */
  if (u_surface >= 0.5) {
    float mass = luminance(colour);
    float inked = laydown(mass, u_inkGain) * keep;

    /* One ink. Pale where the cloud is thin and deep where it piles up, which
       is the same information the light reading carries as brightness, read as
       a density instead. The pigments decide the medium: dark ones are a
       drawing on paper, light ones are chalk on a grey wall. */
    if (u_surface < 1.5) {
      vec3 pigment = mix(u_inkPale, u_inkDeep, clamp(mass * 1.45, 0.0, 1.0));
      float speckle = random(gl_FragCoord.xy + fract(u_time) * 100.0) - 0.5;
      float cov = clamp(inked + speckle * u_grain * inked, 0.0, 1.0);
      fragColor = vec4(pigment * cov, cov);
      return;
    }

    /* Two inks, printed one after the other and slightly out of register,
       which is the whole character of the process: the second plate lands a
       fraction of a millimetre off the first, and the edges of everything
       carry a rim of the other colour. */
    vec3 shifted = tonemap(texture(t_source, v_uv + u_misregister).rgb * u_exposure);
    float inkedB = laydown(luminance(shifted), u_inkGain) * keep;

    /* Screened at fifteen and seventy five degrees. Subtracted in proportion
       to the laydown rather than thresholded against it, so the screen textures
       the cloud instead of posterising it into dots and, again, cannot put a
       mark where there was no ink. */
    inked = clamp(inked - (screenAt(gl_FragCoord.xy, 0.2618, u_screenCell) - 0.5) * u_screenDepth * inked, 0.0, 1.0);
    inkedB = clamp(inkedB - (screenAt(gl_FragCoord.xy, 1.3090, u_screenCell) - 0.5) * u_screenDepth * inkedB, 0.0, 1.0);

    /* Each ink is a filter over the sheet, not a light on top of it, so they
       multiply: where both land the result is darker than either, which is the
       overprint. Then back out of the sheet's own colour, because the page
       supplies that and this pass must only supply the difference. */
    float alpha = 1.0 - (1.0 - inked) * (1.0 - inkedB);
    vec3 printed = u_paper
      * (1.0 - inked * (1.0 - u_inkA))
      * (1.0 - inkedB * (1.0 - u_inkB));
    fragColor = vec4(max(printed - u_paper * (1.0 - alpha), vec3(0.0)), alpha);
    return;
  }

  colour *= keep;

  /* How opaque this pixel is, decided before the grain is added.

     This is a correctness point rather than a stylistic one. The canvas is laid
     over the whole page, so anything with an alpha above nought is sitting on
     top of somebody's paragraph. Grain applied first gives every pixel in the
     viewport a small random alpha, which is a haze over every line of text on
     the site, and it is both invisible in a screenshot of the cloud and fatal
     to the contrast measurement. */
  float presence = clamp(max(colour.r, max(colour.g, colour.b)) * 1.8, 0.0, 1.0);

  /* Grain, added rather than multiplied, so it lifts the darkest parts of the
     cloud very slightly instead of doing nothing there. Scaled by presence for
     the same reason as above: film grain over empty space is not film grain,
     it is noise over the reading. */
  float noise = random(gl_FragCoord.xy + fract(u_time) * 100.0) - 0.5;
  colour += noise * u_grain * presence;

  /* The context is premultiplied, which is what additive accumulation already
     produces: empty space is black and therefore transparent. The two ink
     readings above return their own premultiplied pairs, worked out rather
     than inherited, because a pigment is not its own coverage. */
  fragColor = vec4(encode(colour), presence);
}
`;

/* Used when the quality level has no post chain at all: straight through, with
   the tone map and the colour conversion, because those two are correctness
   rather than decoration. */
export const PLAIN_FRAGMENT = FINAL_FRAGMENT;
