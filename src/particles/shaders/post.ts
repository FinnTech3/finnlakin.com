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
uniform float u_contentDim;
/* Nought on the dark stage, one on paper: which of the two readings of the
   accumulation buffer this frame wants. See the ink block in main. */
uniform float u_inkiness;
uniform float u_inkGain;

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

/* The two pigments the cloud is drawn in once the page is paper.

   Display space rather than linear, because they are chosen against what a
   reader sees rather than computed from a light, which is also why they never
   go through encode(): they are already on the other side of it.

   Pale where the cloud is thin and deep where it is thick, which is how ink
   behaves and the opposite of how light does. A sparse drift of particles is a
   wash; a gyral crown with a hundred particles behind it is a pooled, nearly
   black indigo. One flat pigment, or the ramp run the other way, throws away
   the corrugation the shape exists to have. */
const vec3 INK_PALE = vec3(0.435, 0.517, 0.655);
const vec3 INK_DEEP = vec3(0.055, 0.086, 0.196);

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

  /* How much particle is at this pixel. Both readings below are built from
     this one number, which is what keeps them describing the same cloud. */
  float mass = dot(colour, vec3(0.2126, 0.7152, 0.0722));

  /* How far the cloud is held down so that text laid over it keeps its contrast
     ratio. Applied here, after the tone map, and not in the vertex shader where
     it started.

     That is not a tidying up. Dimming a particle's colour before accumulation
     and tone mapping buys almost nothing in the dense middle: the tone map is
     there precisely to compress large values towards one, so cutting the input
     by a hundredfold moves the output by very little. Measured, a dim of 0.993
     applied per particle still left a relative luminance of 0.09 behind a line
     of body text, where the ceiling is 0.033. Applied to the finished pixel it
     is an honest multiplier: halve it and the measurement halves. */
  float held = 1.0 - u_contentDim;
  colour *= held;

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

  /* The light reading: the cloud as an emitter, over black. The context is
     premultiplied, which is what additive accumulation already produces, since
     empty space is black and therefore transparent. */
  vec3 lightRgb = encode(colour);

  /* The ink reading.

     The accumulation buffer is not really a light. It is a measure of how much
     particle is at each pixel, and treating that as emitted light is only
     correct over black: on paper an additive cloud adds to white and vanishes,
     which is the constraint the dark stage existed to work around.

     So on paper the same number is read as coverage instead. Saturating rather
     than linear, because that is how ink lays down: the first particles over a
     pixel darken it a great deal and the hundredth hardly at all. A linear
     clamp gives a cloud that is either invisible or a flat silhouette with
     nothing in between, and the folds live in the in between. */
  float coverage = (1.0 - exp(-mass * u_inkGain)) * held;
  vec3 pigment = mix(INK_PALE, INK_DEEP, clamp(mass * 1.45, 0.0, 1.0));

  /* Premultiplied explicitly, which the light reading never had to be: there
     the colour is black wherever the alpha is nought, so the multiplication was
     already done by the physics. A dark pigment on a transparent pixel is not,
     and left unmultiplied it paints full strength indigo over the whole page
     wherever the cloud is thin, which is everywhere.

     One expression, mixed, rather than two branches. At u_inkiness nought this
     is exactly the line the dark stage was measured on, so the stage cannot
     quietly regress while the paper is being tuned. */
  fragColor = vec4(
    mix(lightRgb, pigment * coverage, u_inkiness),
    mix(presence, coverage, u_inkiness)
  );
}
`;

/* Used when the quality level has no post chain at all: straight through, with
   the tone map and the colour conversion, because those two are correctness
   rather than decoration. */
export const PLAIN_FRAGMENT = FINAL_FRAGMENT;
