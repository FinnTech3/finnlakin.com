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

   u_maskSide is +1 when the cloud's column is the right of the screen and -1
   when it is the left; u_maskEdge is where that column starts. u_gapCentre and
   u_gapHalf are the strip between two sections, which is the only horizontal
   road across the page that has no text on it. */
uniform float u_maskEdge;
uniform float u_maskSide;
uniform float u_maskFeather;
uniform float u_gapCentre;
uniform float u_gapHalf;
uniform float u_maskOff;

float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
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
  vec3 colour = texture(t_source, v_uv).rgb * u_exposure;
  colour = tonemap(colour);

  vec2 offset = (v_uv - 0.5) * u_vignetteOffset;
  colour = mix(colour, vec3(0.0), clamp(dot(offset, offset) * u_vignetteDarkness, 0.0, 1.0));

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
  float keep = u_maskSide == 0.0
    ? 0.0
    : smoothstep(0.0, u_maskFeather, (v_uv.x - u_maskEdge) * u_maskSide);

  /* And the road across. While the cloud is changing sides it is not in either
     column, it is in the gap between two sections, which is the one band of the
     page with no text in it. The strip is nought height when it is not
     crossing, so this term contributes nothing the rest of the time. */
  if (u_gapHalf > 0.0) {
    float toEdge = abs(v_uv.y - u_gapCentre);
    keep = max(keep, 1.0 - smoothstep(u_gapHalf * 0.6, u_gapHalf, toEdge));
  }

  /* And the escape, for every case with no column to keep out of: a phone
     before the cloud has anywhere to be, a reduced motion frame, the routes
     that mount the canvas without the page that shapes it. One uniform rather
     than a sentinel inside another, because a mask that silently means "all of
     it" when a number happens to be nought is the kind of thing that ships
     inverted. */
  keep = max(keep, u_maskOff);

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
     produces: empty space is black and therefore transparent.

     There was briefly a second reading here, for when the page below the stage
     was paper: the same accumulation read as ink coverage with a dark pigment,
     because an additive cloud over white adds to white and vanishes. The site
     is one dark surface now and the cloud is behind the page rather than over
     it, so there is nothing for an ink to be laid on. It is in the history if
     the background ever goes light again.
  */
  fragColor = vec4(encode(colour), presence);
}
`;

/* Used when the quality level has no post chain at all: straight through, with
   the tone map and the colour conversion, because those two are correctness
   rather than decoration. */
export const PLAIN_FRAGMENT = FINAL_FRAGMENT;
