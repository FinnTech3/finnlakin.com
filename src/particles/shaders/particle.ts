import { COMMON } from "./common";

/* The particles themselves: one pyramid geometry, ten thousand instances, and a
   vertex shader that gets each instance's position by reading the texture the
   simulation just wrote rather than from the geometry it was given.

   That is the whole trick, and it is worth being plain about why it matters.
   The geometry buffer holds twelve vertices, once. Everything that makes ten
   thousand particles different from each other, where they are, how big they
   are, which way they point, what colour they are, comes out of textures in the
   vertex stage. Nothing per particle is ever uploaded after startup. */

export const PARTICLE_VERTEX = `#version 300 es
precision highp float;

/* The shared pyramid. */
layout(location = 0) in vec3 a_vertex;
layout(location = 1) in vec3 a_normal;

/* Per instance. */
layout(location = 2) in vec2 a_id;
layout(location = 3) in vec4 a_random;
layout(location = 4) in float a_index;

uniform sampler2D t_position;
uniform sampler2D t_scale;
uniform sampler2D t_colour;

uniform mat4 u_projection;
uniform mat4 u_view;

uniform float u_factor;
uniform float u_time;
uniform float u_scale;
uniform float u_amplitude;
uniform float u_colourFactor;
uniform float u_progress;
uniform float u_explode;
uniform float u_contentDim;
uniform float u_mobileRotation;
uniform vec3 u_offset;
uniform vec3 u_rotation;
uniform vec3 u_camera;
uniform vec2 u_mouse;

out vec3 v_colour;
out vec3 v_normal;
out vec3 v_pos;
out vec3 v_view;

${COMMON}

void main() {
  /* The simulation writes into the lower left quarter of its target, so the
     instance's own coordinate is halved to reach it. a_id already carries the
     half texel offset that keeps this off the seam between two particles. */
  vec3 simulated = texture(t_position, a_id * 0.5).xyz;
  vec3 pos = (simulated - 0.5) * 2.0 * u_factor;

  /* Scale follows the same four quadrant layout as position, so a particle can
     be a different size in each shape it becomes. */
  float scale1 = texture(t_scale, quadrantUV(a_id, 0)).r;
  float scale2 = texture(t_scale, quadrantUV(a_id, 1)).r;
  float scale3 = texture(t_scale, quadrantUV(a_id, 2)).r;
  float scale4 = texture(t_scale, quadrantUV(a_id, 3)).r;

  float scale = mix(scale1, scale2, clamp01(u_progress));
  scale = mix(scale, scale3, clamp01(u_progress - 1.0));
  scale = mix(scale, scale4, clamp01(u_progress - 2.0));
  scale *= u_scale;

  /* Scattered particles read as further away, so they shrink a little. Without
     this the cloud expands into a field of identical shards and loses the sense
     that it came apart from something. */
  scale *= mix(1.0, 0.72 + a_random.z * 0.5, clamp01(u_explode));

  /* Two orientations. On a desktop the particle tumbles, driven by noise
     sampled at its own position so that neighbours turn together and the cloud
     has currents in it rather than ten thousand independent spins. On a phone
     it faces the reader, because a phone is held still and a particle that
     never turns towards the eye reads as a speck. */
  float n = gnoise(pos * u_amplitude);
  float angle = mod(n * TAU + u_time * 0.35 + a_random.w * TAU, TAU);
  mat3 tumble = rotationMatrix(normalize(vec3(0.35 + a_random.x * 0.3, 1.0, 1.0)), angle);
  mat3 facing = lookAtMatrix(pos, u_camera);
  mat3 spin = u_mobileRotation > 0.5 ? facing : tumble;

  vec3 local = spin * (a_vertex * scale);
  vec3 normal = spin * a_normal;

  /* The whole field turns as one, after each particle has turned on its own.
     These are separate rotations and conflating them is what makes a particle
     cloud look like a texture painted on a rotating ball. */
  mat3 field = rotateZ(u_rotation.z) * rotateY(u_rotation.y) * rotateX(u_rotation.x);
  vec3 world = field * (pos + local) + u_offset;
  normal = field * normal;

  /* Colour, from the same quadrant layout again. */
  vec3 colour1 = texture(t_colour, quadrantUV(a_id, 0)).rgb;
  vec3 colour2 = texture(t_colour, quadrantUV(a_id, 1)).rgb;
  vec3 colour3 = texture(t_colour, quadrantUV(a_id, 2)).rgb;
  vec3 colour4 = texture(t_colour, quadrantUV(a_id, 3)).rgb;

  vec3 tint = mix(colour1, colour2, clamp01(u_progress));
  tint = mix(tint, colour3, clamp01(u_progress - 1.0));
  tint = mix(tint, colour4, clamp01(u_progress - 2.0));
  tint *= u_colourFactor;

  /* Scattered particles lose some of their colour, which is what stops the
     dispersed state reading as confetti. Partially, not completely: the
     specification is explicit that they stay recognisably coloured. */
  tint = mix(tint, vec3(0.45), clamp01(u_explode) * 0.35);

  v_colour = tint * (1.0 - u_contentDim);
  v_normal = normal;
  v_pos = world;

  vec4 viewPosition = u_view * vec4(world, 1.0);
  v_view = viewPosition.xyz;
  gl_Position = u_projection * viewPosition;
}
`;

export const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;

in vec3 v_colour;
in vec3 v_normal;
in vec3 v_pos;

out vec4 fragColor;

void main() {
  /* Enough shading to tell one face of a pyramid from another, and no more.
     A full lighting model here would fight the authored colour, which is the
     thing the palette was chosen for. Two fixed directions, one cool and one
     warm, is the smallest thing that makes the facets read as solid. */
  vec3 normal = normalize(v_normal);
  float key = max(0.0, dot(normal, normalize(vec3(-0.4, 0.8, 0.45))));
  float fill = max(0.0, dot(normal, normalize(vec3(0.6, -0.3, 0.7))));
  float shade = 0.45 + key * 0.72 + fill * 0.22;

  /* Depth sensitive alpha: particles at the back of the cloud fade, which is
     what gives ten thousand overlapping shards a front and a back instead of a
     uniform mass. */
  float alpha = smoothstep(-4.5, 4.0, v_pos.z);

  fragColor = vec4(v_colour * shade * alpha, alpha);
}
`;

/* The depth pass. It has to apply exactly the same transform as the colour
   pass, or the depth of field blurs the wrong particles, so the vertex source
   is generated from the same string with a different ending rather than written
   out a second time and kept in step by hand. */
export const DEPTH_FRAGMENT = `#version 300 es
precision highp float;

in vec3 v_view;

uniform float u_near;
uniform float u_far;

out vec4 fragColor;

void main() {
  /* View space, not world space. The camera sits ten units back, so a particle
     at the origin is ten units away and its world z is nought: reading depth
     off the world position puts the entire cloud at the near plane and the
     depth of field then blurs whatever it likes.

     Linear rather than the hyperbolic value in the depth buffer, and written to
     all three channels so that the debug view of this texture is readable. */
  float depth = clamp((-v_view.z - u_near) / (u_far - u_near), 0.0, 1.0);
  fragColor = vec4(vec3(depth), 1.0);
}
`;
