# The particle brain

A GPU particle engine: ten thousand instanced three dimensional pyramids whose
positions and velocities live in floating point textures, driven by a spring
solver that runs entirely on the graphics card, morphing between four shapes as
the page scrolls.

It is the opening animation and the background of the home page. Nothing else
on the site uses it, and nothing else downloads it.

## Why it is written by hand

The obvious way to build this is Three.js, and the specification it was built
from names Three.js APIs throughout. It is not used here, for one measured
reason: the site's JavaScript budget is asserted in `tests/performance.spec.ts`
as uncompressed bytes on the home page, and Three.js minified is larger than
this site's entire payload was before any of this existed. Adopting it would
have roughly tripled the number the site is measured on.

Written directly against WebGL2 the whole engine is 47KB uncompressed, about
12KB over the wire, and every capability the specification asks for is reached:
instanced geometry, ping ponged simulation, four morph targets with per particle
ordering, depth, bloom, depth of field, vignette and grain.

## Architecture

```
scroll ─┐
        ├─→ ParticleTimeline ─→ uniforms ─┐
pointer ┘                                 │
                                          ▼
      velocity pass  ──swap──→  position pass  ──swap──→  position texture
       (100 x 100)               (100 x 100)                     │
                                                                 ▼
                                             instanced draw, 10,000 pyramids
                                                                 │
                                          ┌──────────────────────┤
                                          ▼                      ▼
                                     depth pass            HDR scene target
                                          │                      │
                                          └────→ bloom ─→ bokeh ─→ vignette,
                                                          grain, tone map ─→ screen
```

The processor updates uniforms, the scroll position, the pointer and the render
targets. It never calculates where a particle is.

| File | Does |
|---|---|
| `src/particles/engine.ts` | Owns everything, one frame at a time. The only public surface. |
| `src/particles/simulation.ts` | The two GPU passes and the textures they read. |
| `src/particles/renderer.ts` | The instanced colour pass and the depth pass. |
| `src/particles/post.ts` | Bright pass, five level bloom, bokeh, vignette, grain, tone map. |
| `src/particles/timeline.ts` | Scroll position in, composition out. |
| `src/particles/targets.ts` | Packs four shapes into quadrants, builds the parameter textures. |
| `src/particles/brain-shape.ts` | The brain, and the three shapes derived from it. |
| `src/particles/words.ts` | Text to particle targets, for the opening animation. |
| `src/particles/quality.ts` | What the machine can do, and what to ask of it. |
| `src/particles/ping-pong.ts` | A pair of targets, one read while the other is written. |
| `src/particles/palette.ts` | The colours. One file, one edit. |
| `src/components/particle-brain.tsx` | The canvas, the frame loop and five listeners. |
| `src/components/particle-brain-mount.tsx` | Loads it, on the home page only. |

## The simulation

Every particle carries a position and a velocity, both in textures, both
normalised nought to one. Two full screen passes a frame:

1. **Velocity.** Reads the previous position and velocity, resolves where the
   particle should be right now by blending the four morph targets, applies the
   explosion, gates the spring on for the entrance and adds the pointer's
   parting, and accelerates towards it.
   `velocity = (velocity + (target - previous) * spring + flee) * friction`
2. **Position.** `position = previous + velocity`.

The order matters. Velocity is written and swapped first, so the position pass
reads the velocity just written rather than the one before it. Reversed, the
system lags its own forces by a frame: it does not look broken, it feels heavy,
and it is nearly impossible to find by reading the shaders.

**The simulation runs on its own fixed clock of one sixtieth of a second**, and
the frame loop feeds it however many steps have come due, up to twenty. The
spring constants are per frame at sixty frames a second, not per second; run
once per drawn frame they describe a different animation on every machine.

## Textures

| Texture | Size | Holds |
|---|---|---|
| position, velocity | 200 x 200, ping ponged | Particle state, in the lower left quarter |
| targets | 200 x 200 | Four shapes, one per quadrant |
| scale | 200 x 200 | Per particle size, per shape |
| colour | 200 x 200 | Per particle colour, per shape |
| parameter 1 | 100 x 100 | Signed random, row helper, display order, spring offset |
| parameter 2 | 100 x 100 | Morph orderings for targets two, three and four, and the explosion |
| parameter 3 | 100 x 100 | Explosion multiplier, signed random, normalised x |

The simulation only needs a quarter of its 200 x 200 target, so the passes set
the viewport to 100 x 100 and three quarters of the pixels are never shaded.

Float where the machine supports rendering into it, half float where it does
not, detected by allocating one and asking whether it worked rather than by
reading extension strings.

## Morphing

A particle's transition is delayed by its own place in an ordering, and the
ordering is spatial: sorted along an axis, so the change sweeps across the shape
as a wave rather than every particle moving at once.

```glsl
float delayedProgress(float globalProgress, float localOrder, float delay, float count) {
  float stretched = globalProgress * (1.0 + delay * (count - 1.0));
  return clamp01(stretched - delay * localOrder);
}
```

Orderings are stored normalised and multiplied back up in the shader. Stored
raw, a rank of nine thousand sits above the range where a half float texture can
keep consecutive integers apart, and the wave arrives in visible steps.

## The brain

Procedural, not a model file. A Fibonacci sphere pushed into a brain: flat
underneath, a temporal lobe cut away by a lateral sulcus, a tapered occipital
pole, a narrowed frontal pole, folds displacing the surface along its normal, a
fissure down the midline, a cerebellum with its own foliation and a short stem.

It is mostly hollow, which is a decision rather than an accident: a thin skin
carries about ninety five percent of the particles and a twentieth are scattered
deeper, so the cortex is dense enough to read as folded matter and the cloud
still has something inside it when it turns. Everything freed from the interior
lands on the surface, so the same ten thousand particles buy a much denser
cortex.

**The sulci are emptied by rejection rather than by thinning.** A particle takes
a direction, and if that direction lands in a valley between folds it takes
another direction entirely, up to two dozen times. The earlier version computed
the same probability and then, instead of resampling, moved the rejected
particle six percent inward: every particle was written either way, the valleys
were never empty, and from outside the cortex was a uniform fuzz. The gaps are
what make folds read as folds.

Colour comes from a slow regional field rather than from height or from fold
depth. Fold depth was the obvious choice and it is wrong once the valleys are
empty, because almost every surviving particle is then on a crest and the whole
cloud comes out one colour.

The other three targets are derived from the brain per particle rather than
generated separately, so particle four thousand is the same speck of matter in
every shape it passes through and a morph reads as the cloud rearranging.

`npm run check:brain` validates the result and prints a checksum: four targets,
correct texture dimensions, no NaN or Infinity, everything in range, every
ordering a true permutation, no collapsed quadrant, the shell measured by
directional buckets rather than against a single radius, the colour ramp's
spread, and the same bytes every time from seed 1337. It runs as part of
`npm run lint`.

The shell is measured directionally because a brain is not a sphere: the first
attempt compared every particle against the single furthest one and reported
twenty two percent skin for a cloud that was ninety five percent shell. It now
buckets by direction and compares each particle against the furthest one in its
own bucket, which measures 86.6%.

## The pointer

The cloud parts around the cursor, like a shoal of fish getting out of the way.
Two forces per particle, both falling off with distance:

```glsl
vec3 away = previous - u_pointer;
float reach = (1.0 - smoothstep(0.0, u_pointerReach, length(away))) * u_pointerActive;
vec3 flee = (direction * u_pointerPush + cross(direction, axis) * u_pointerSwirl) * reach;
```

The radial term opens the hole. The tangential one is what makes it a shoal
rather than an explosion: they stream around the obstruction instead of straight
out. Nothing pulls them back, because the spring already does that, so the hole
closes on its own as the pointer leaves.

Two things to know before changing it. **`smoothstep` is undefined in GLSL when
its first edge is not less than its second**, and written the natural way round,
`smoothstep(u_pointerReach, 0.0, gap)`, this driver returns zero for every
particle: the force is wired correctly all the way through and multiplied by
nothing at the last step, which is invisible in a screenshot and survives every
check that the uniforms arrived. And the pointer is a screen position while the
simulation works in a unit cube, so `pointerInCloudSpace` in `mouse.ts` undoes
the projection, the offset, the rotation and the scale, once a frame on the
processor rather than per particle on the card.

Off under reduced motion, and the listeners are only attached when
`(hover: hover)` matches, so a phone is unaffected rather than subtly broken.

## The opening animation

Two more entries in the same target texture. `FINN LAKIN`, then `ECONOMICS,
FINANCE, SOFTWARE DEV`, then the brain, morphed by the same machinery as
everything else. Text is measured and drawn on an offscreen canvas and its
covered pixels become positions; the block is sized to the middle third of the
screen, taking most of the width on a phone and a little over a third on a
monitor.

**The entrance comes in from every edge of the screen.** Each particle is seeded
on the perimeter of a rectangle a quarter beyond the viewport, at its own depth,
and held there by having no spring at all until the reveal releases it; the slot
it waits for is its display order, which is a shuffle of every index and so is
uniform across the cloud whatever subset of it a quality level is drawing. The
spring then does the whole animation, which is why there is no dispersal term in
the velocity shader any more.

The rectangle is walked in screen space and carried back into the simulation's
own space by the same inverse the pointer uses, so portrait and landscape need
no branch between them. Its four edges take shares of the walk in proportion to
their length rather than a quarter each: a quarter each puts twice as many
particles per centimetre on the short sides of a wide monitor, and the sides
fountain while the top and bottom trickle. The entry is resolved along the ray
through the screen point rather than on the cloud's own plane, so a particle
coming in from behind is placed proportionally wider and stays exactly on the
frame's edge; placed on the plane and given depth afterwards, a rotated cloud
carries part of that depth into the horizontal and an eighth of the particles on
a portrait phone start on screen.

`scripts/check-motion.ts` asserts both properties, projecting every seeded
position forward again through an independently written transform.

The handover is invisible by construction: the intro's texture holds the brain
shrunk by exactly the ratio between the two factors, so the texture swap and the
factor change happen in the same frame and cancel.

The veil is `.intro` in `globals.css`, and an inline script in the layout decides
before the first paint whether the animation runs at all. A reader with no
JavaScript never gets the attribute and so never gets the overlay. The script
also clears the attribute after twelve seconds as a failsafe, in case the engine
chunk never arrives.

## Contrast

The canvas is above the scrim, so its colours run at full strength, and it is
underneath every word on the page. `tests/backdrop.spec.ts` measures the
brightest background pixel inside each text element's own box, at eight points
across the timeline, against that element's own colour.

The dimming that keeps that legal is applied **after** the tone map, in the
final pass, and not per particle in the vertex shader. The tone map exists to
compress large values towards one, so cutting a particle's colour by a
hundredfold barely moves the finished pixel: a dim of 0.993 applied per particle
still measured a relative luminance of 0.09 behind body text, where the ceiling
is 0.033.

Behind text the cloud runs at about one percent of full strength. That is a real
cost: the explosion and the morph are properly visible in the opening screen and
in the gaps, and are a faint presence behind prose.

## Scroll

Progress runs nought to six and is read off the real sections rather than off
the document height, because the sections are not equal heights: section n's top
reaching the top of the viewport is progress n exactly.

Three things that are easy to get wrong and were:

- **The boundaries have to be re-measured.** Measured once from resize, they are
  measured before the web fonts arrive, and fonts change the height of every
  block of text on the page. They are re-measured when `document.fonts.ready`
  resolves and whenever a section or the body changes size, which also covers
  an image finishing, a chart laying out and a phone being turned.
- **The eased value needs a speed limit.** An ease covers a proportion of
  whatever gap it is given, so a gap of six sections is crossed about as quickly
  as a gap of one, and the call to action is an anchor to the contact section,
  which makes exactly that gap. Capped at four sections a second.
- **The timeline has to start where the page is.** Its constructor starts it at
  the opening composition, which is right for a reader arriving at the top and
  wrong for one who reloaded halfway down. The opening animation is the one
  exception, because releasing its held composition is what carries the cloud
  into place.

At phone width the cloud sits below the hero's text rather than beside it, and
`hero.tsx` reserves the band so the reconstruction table is not in the same
place. The dim ramp also finishes sooner on a narrow screen, because the text
arrives under the cloud after a couple of hundred pixels of scroll.

## Configuration

Everything in `DEFAULTS` in `src/particles/types.ts`:

| To change | Set |
|---|---|
| Particle count | `particleCount`, `gridSize` (the grid is the square root) |
| Brain scale | `factorDesktop`, `factorMobile` |
| Particle scale | `particleScaleDesktop`, `particleScaleMobile` |
| Colour palette | `RAMP`, `WARM`, `WARM_SHARE` in `palette.ts` |
| Spring, friction | `spring`, `friction` |
| Pointer parting | `pointerReach`, `pointerPush`, `pointerSwirl`, `mouseSmoothing` |
| Entrance | `entryWindow`, `SHOW_SECONDS` in `engine.ts`, the constants in `entrance.ts` |
| Scroll sensitivity | `scrollEase`, `MAX_SECTIONS_PER_SECOND` in `scroll.ts` |
| Morph speed | `morphDelayDesktop`, `morphDelayMobile`, `secondaryMorphDelay` |
| Explosion | `explosionDelay`, and the multiplier in `targets.ts` |
| Bloom | `bloomStrength`, `bloomThreshold`, `bloomRadius` |
| Bokeh | the constants at the top of `post.ts` |
| Grain | `grainStrength` |
| Vignette | `vignetteOffset`, `vignetteDarkness` |
| Section timings | the `mapClamped` stacks in `timeline.ts` |

## Performance and quality

| Level | Desktop | Mobile | Post chain |
|---|---|---|---|
| high | 10,000 | 7,000 | bloom, bokeh, vignette, grain |
| medium | 7,500 | 5,000 | bloom, vignette, grain |
| low | 4,000 | 3,000 | vignette, grain |

The level is chosen from the renderer string and the core count, then corrected
by timing the frames: below 42fps sustained it steps down, above 56fps it may
step up once, and never after it has stepped down.

A lower level draws fewer instances of the same simulation. Particle index is
shuffled against position, so drawing the first four thousand gives an even
sample of the whole shape rather than one end of it.

The drawing buffer is capped by area rather than by edge, at 2.2 million pixels.

## Debugging

- `?brainQuality=high|medium|low|off` forces a level, or turns it off entirely.
  The tests use this, because a software rasteriser would otherwise be stepped
  straight down and the top path would never run.
- `?brainDebug=1` marks the host element.
- Shader compilation and framebuffer failures print the full log in development
  and are silent in production, where every route is asserted console clean.

## Reduced motion, visibility and failure

- `prefers-reduced-motion: reduce` gets one settled frame, stepped to
  convergence at startup rather than animated, redrawn on scroll and resize.
- A hidden tab stops drawing. On return the clock does not jump.
- No WebGL2, no float render target, a shader that will not compile or a
  framebuffer the driver refuses: `createParticleBrain` returns null and the page
  keeps the flat gradient it was already painting.
- A lost context shows the gradient rather than asking for the GPU back.
- Unmounting disposes every program, buffer, texture, framebuffer and listener.

## Integration

```tsx
const engine = createParticleBrain({ canvas, quality, reducedMotion, intro, onIntroEnd });
engine.frame(performance.now());
engine.pointer(clientX, clientY);
engine.resize();
engine.setQuality("medium");
engine.dispose();
```

The host owns the loop, because the host is what knows about visibility,
reduced motion and the route. Nothing that changes per frame is React state.
