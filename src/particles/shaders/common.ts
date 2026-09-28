/* GLSL every stage shares. Prepended rather than copied, so the ordering maths
   the velocity shader uses and the ordering maths the vertex shader uses are
   the same lines of code and cannot drift.

   The noise is gradient noise written here rather than an imported simplex
   implementation. It is about twenty lines, it is deterministic across drivers,
   and it means this file has no provenance question hanging over it. */
export const COMMON = `
#define TAU 6.28318530718

float clamp01(float x) { return clamp(x, 0.0, 1.0); }

float map(float value, float inMin, float inMax, float outMin, float outMax) {
  float span = inMax - inMin;
  float t = span == 0.0 ? 0.0 : (value - inMin) / span;
  return outMin + t * (outMax - outMin);
}

float mapClamped(float value, float inMin, float inMax, float outMin, float outMax) {
  float mapped = map(value, inMin, inMax, outMin, outMax);
  return clamp(mapped, min(outMin, outMax), max(outMin, outMax));
}

float qinticInOut(float x) {
  float t = clamp01(x);
  return t < 0.5 ? 16.0 * t * t * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 5.0) / 2.0;
}

vec3 hash33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
}

/* Gradient noise: eight corner gradients, smoothstep interpolation. Returns
   roughly minus one through one. */
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  float n000 = dot(hash33(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0));
  float n100 = dot(hash33(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(hash33(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(hash33(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(hash33(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(hash33(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(hash33(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(hash33(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0));

  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}

mat3 rotationMatrix(vec3 axis, float angle) {
  vec3 a = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float t = 1.0 - c;
  return mat3(
    t * a.x * a.x + c,       t * a.x * a.y - s * a.z, t * a.x * a.z + s * a.y,
    t * a.x * a.y + s * a.z, t * a.y * a.y + c,       t * a.y * a.z - s * a.x,
    t * a.x * a.z - s * a.y, t * a.y * a.z + s * a.x, t * a.z * a.z + c
  );
}

/* Orients a particle so its local plus Z points at the eye. Used on phones,
   where the specification asks for a look at orientation instead of the
   desktop's noise driven tumble: a phone is held still, so a particle that
   never turns to face the reader reads as a speck rather than as a solid. */
mat3 lookAtMatrix(vec3 from, vec3 to) {
  vec3 forward = normalize(to - from);
  vec3 reference = abs(forward.y) > 0.99 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(reference, forward));
  vec3 up = cross(forward, right);
  return mat3(right, up, forward);
}

mat3 rotateX(float a) {
  float s = sin(a); float c = cos(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}

mat3 rotateY(float a) {
  float s = sin(a); float c = cos(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

mat3 rotateZ(float a) {
  float s = sin(a); float c = cos(a);
  return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0);
}

/* The four morph targets are packed as quadrants of one texture, so a particle
   samples the same coordinate four times with a different offset. */
vec2 quadrantUV(vec2 uv, int target) {
  vec2 scaled = uv * 0.5;
  if (target == 1) return scaled + vec2(0.5, 0.0);
  if (target == 2) return scaled + vec2(0.0, 0.5);
  if (target == 3) return scaled + vec2(0.5, 0.5);
  return scaled;
}

/* Where one particle is in a transition that the whole cloud is making.

   Without this every particle would move at once and the morph would read as
   the shape being replaced. With it, each particle waits its turn according to
   an ordering that was sorted along an axis when the asset was built, so the
   change sweeps across the shape as a wave.

   The multiplier on globalProgress is what keeps the last particle finishing
   exactly when the transition does: the whole run is stretched by the total
   delay, then each particle's own delay is subtracted back off. */
float delayedProgress(float globalProgress, float localOrder, float delayFactor, float count) {
  float stretched = globalProgress * (1.0 + delayFactor * (count - 1.0));
  return clamp01(stretched - delayFactor * localOrder);
}
`;
