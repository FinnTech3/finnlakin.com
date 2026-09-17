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
   explosion and the opening reveal, and accelerates towards it.
   `velocity = (velocity + (target - previous) * spring) * friction`
2. **Position.** `position = previous + velocity`.

The order matters. Velocity is written and swapped first, so the position pass
reads the velocity just written rather than the one before it. Reversed, the
system lags its own forces by a frame: it does not look broken, it feels heavy,
and it is nearly impossible to find by reading the shaders.

**The simulation runs on its own fixed clock of one sixtieth of a second**, and
the frame loop feeds it however many steps have come due, up to thirty. The
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

It fills rather than shells: a particle takes a direction on the surface and
then a radius along it, biased hard towards the outside, so the cortex is dense
and the interior is populated but thinner. A shell and a volume look identical
until the cloud turns or comes apart, and then the shell reads as a paper model.

The other three targets are derived from the brain per particle rather than
generated separately, so particle four thousand is the same speck of matter in
every shape it passes through and a morph reads as the cloud rearranging.

`npm run check:brain` validates the result and prints a checksum: four targets,
correct texture dimensions, no NaN or Infinity, everything in range, every
ordering a true permutation, no collapsed quadrant, and the same bytes every
time from seed 1337. It runs as part of `npm run lint`.

## The opening animation

Two more entries in the same target texture. `FINN LAKIN`, then `ECONOMICS,
FINANCE, SOFTWARE DEV`, then the brain, morphed by the same machinery as
everything else. Text is measured and drawn on an offscreen canvas and its
covered pixels become positions; the block is sized to the middle third of the
screen, taking most of the width on a phone and a little over a third on a
monitor.

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

## Configuration

Everything in `DEFAULTS` in `src/particles/types.ts`:

| To change | Set |
|---|---|
| Particle count | `particleCount`, `gridSize` (the grid is the square root) |
| Brain scale | `factorDesktop`, `factorMobile` |
| Particle scale | `particleScaleDesktop`, `particleScaleMobile` |
| Colour palette | `RAMP`, `WARM`, `WARM_SHARE` in `palette.ts` |
| Spring, friction | `spring`, `friction` |
| Mouse sensitivity | `mouseStrength`, `mouseSmoothing` |
| Scroll sensitivity | `scrollEase` |
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
