import { COMMON } from "./common";

/* The two passes that hold every particle's state.

   Nothing in here runs on the processor. Ten thousand particles each carrying a
   position and a velocity is a hundred and twenty thousand floats a frame, and
   the reason to keep them in a texture is not that it is faster to compute but
   that the answer never has to come back: the vertex shader reads the same
   texture the simulation just wrote, and the number never crosses the bus.

   Both passes work in normalised space, nought to one, and the conversion to
   world space happens once at render. That is worth stating because it is the
   most common place this kind of engine goes wrong: two coordinate systems and
   a spring constant tuned in whichever one the author happened to be in. */

/* Velocity. Reads the previous position and the previous velocity, resolves
   where the particle is supposed to be right now, and accelerates towards it.
   The target is not a fixed shape: it is four shapes, blended by a progress
   value that each particle reaches at its own moment. */
export const VELOCITY_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D t_targets;
uniform sampler2D t_position;
uniform sampler2D t_velocity;
uniform sampler2D t_param1;
uniform sampler2D t_param2;
uniform sampler2D t_param3;

uniform float u_progress;
uniform float u_morphDelay;
uniform float u_secondaryDelay;
uniform float u_explosionDelay;
uniform float u_length;
uniform float u_spring;
uniform float u_friction;
uniform float u_explode;
uniform float u_show;
uniform vec3 u_pointer;
uniform float u_pointerReach;
uniform float u_pointerPush;
uniform float u_pointerSwirl;
uniform float u_pointerActive;

${COMMON}

void main() {
  /* The simulation covers the lower left quarter of its own target, so reading
     its previous value means halving the coordinate. The four morph targets
     live in the four quarters of a different texture at full size. */
  vec2 simUv = v_uv * 0.5;

  vec4 param1 = texture(t_param1, v_uv);
  vec4 param2 = texture(t_param2, v_uv);
  vec4 param3 = texture(t_param3, v_uv);

  vec3 target1 = texture(t_targets, quadrantUV(v_uv, 0)).xyz;
  vec3 target2 = texture(t_targets, quadrantUV(v_uv, 1)).xyz;
  vec3 target3 = texture(t_targets, quadrantUV(v_uv, 2)).xyz;
  vec3 target4 = texture(t_targets, quadrantUV(v_uv, 3)).xyz;

  /* The orderings are stored normalised and multiplied back up here. Stored raw,
     a rank of nine thousand sits above the range where a half float texture can
     keep consecutive integers apart, and on a machine that falls back to half
     float the morph wave arrives in visible steps instead of sweeping. */
  float span = u_length - 1.0;
  float progress12 = delayedProgress(u_progress, param2.r * span, u_morphDelay, u_length);
  float progress23 = delayedProgress(max(u_progress - 1.0, 0.0), param2.g * span, u_secondaryDelay, u_length);
  float progress34 = delayedProgress(max(u_progress - 2.0, 0.0), param2.b * span, u_morphDelay, u_length);

  vec3 target = mix(target1, target2, progress12);
  target = mix(target, target3, progress23);
  target = mix(target, target4, progress34);

  /* Outward along the particle's own relationship to the centre, not a blunt
     multiply of the position. A blunt multiply moves the whole cloud away from
     the origin as well as expanding it, which reads as the brain sliding off
     rather than coming apart. */
  vec3 centre = vec3(0.5);
  float burst = delayedProgress(u_explode, param2.a * span, u_explosionDelay, u_length);
  float multiplier = mix(1.0, param3.r, burst);
  target = centre + (target - centre) * multiplier;

  /* The opening reveal: the cloud starts wider than it ends and is drawn in.
     Quintic easing, so it is slow at both ends and quick through the middle,
     which is what makes it look pulled rather than slid. */
  float reveal = qinticInOut(u_show);
  float dispersal = mix(1.55 + param3.g * 0.45, 1.0, reveal);
  target = centre + (target - centre) * dispersal;

  vec3 previous = texture(t_position, simUv).xyz;
  vec3 velocity = texture(t_velocity, simUv).xyz;

  /* Each particle's spring is very slightly its own. Identical springs make a
     cloud that breathes in unison, which is the one thing that gives away that
     it is a simulation rather than a swarm. */
  float spring = u_spring + param1.a;
  vec3 acceleration = (target - previous) * spring;

  /* The pointer parts the cloud: a shoal of fish getting out of the way.

     Two forces, and the second is what makes it a shoal rather than an
     explosion. The radial one pushes a particle directly away and opens the
     hole. The tangential one, at right angles to it, makes them stream around
     the obstruction instead of straight out, which is what a fish does and what
     a blast wave does not.

     Nothing pulls them back: the spring above already does that, so the hole
     closes on its own as the pointer leaves. */
  vec3 away = previous - u_pointer;
  float gap = length(away);
  vec3 direction = gap > 0.0001 ? away / gap : vec3(0.0, 1.0, 0.0);
  /* One minus a forward smoothstep, not a reversed one.

     smoothstep is undefined in GLSL when its first edge is not less than its
     second, and written the other way round, smoothstep(reach, 0.0, gap), this
     driver returns zero for every particle. The force was wired correctly all
     the way through and multiplied by nothing at the last step, which is
     invisible in a screenshot and survives every check that the uniforms
     arrived. */
  float reach = (1.0 - smoothstep(0.0, u_pointerReach, gap)) * u_pointerActive;

  /* Each particle leans its own way around, so they do not all sweep the same
     side and leave a comb mark. */
  vec3 axis = normalize(vec3(param1.r, 1.0, param3.g));
  vec3 sideways = cross(direction, axis);

  vec3 flee = (direction * u_pointerPush + sideways * u_pointerSwirl) * reach;

  velocity = (velocity + acceleration + flee) * u_friction;
  fragColor = vec4(velocity, 1.0);
}
`;

/* Position. Deliberately almost nothing: advance by the velocity that the pass
   above just wrote. Every decision about where a particle should be going was
   made there, which is what keeps the two from disagreeing. */
export const POSITION_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D t_position;
uniform sampler2D t_velocity;

void main() {
  vec2 simUv = v_uv * 0.5;
  vec3 previous = texture(t_position, simUv).xyz;
  vec3 velocity = texture(t_velocity, simUv).xyz;
  fragColor = vec4(previous + velocity, 1.0);
}
`;
