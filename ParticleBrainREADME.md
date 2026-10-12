# The particle brain

A GPU particle engine: thirty two thousand instanced three dimensional
pyramids whose positions and velocities live in floating point textures, driven
by a spring solver that runs entirely on the graphics card, morphing between
seven shapes as the page scrolls. A phone builds fourteen thousand.

It is the opening animation, the first screen of the home page, and the cloud
that goes on travelling down the page beside the writing.

The particles accumulate additively into a float target, which is the only way
to draw thirty thousand overlapping shards without sorting them. What that
buffer means is a choice the final pass makes, and there are three (see
Surfaces). The site is a warm grey wall with chalk dust on it, so it passes the
`ink` reading: the buffer is how much chalk has been laid down, and the cloud is
pale marks on a mid grey page. Nothing between the root element and the content
paints an opaque background, the cloud sits behind all of it at `z-index: -10`,
and what keeps it off the words is the lane rather than the layer.

The opening animation runs on a carbon veil, which is the one dark thing the
cloud is ever over, so the words are legible for the eight seconds they are the
only thing on screen. Chalk over carbon and chalk over the wall are the same
pigment over two grounds, which is why the engine needs no change between them.

The first reading of the buffer was as emitted light, with bloom and depth of
field, over a black page. It is still in the engine and still the default for a
caller that does not ask for anything else, but no page on this site uses it.

## Why it is written by hand

The obvious way to build this is Three.js, and the specification it was built
from names Three.js APIs throughout. It is not used here, for one measured
reason: the site's JavaScript budget is asserted in `tests/performance.spec.ts`
as uncompressed bytes on the home page, and Three.js minified is larger than
this site's entire payload was before any of this existed. Adopting it would
have roughly tripled the number the site is measured on.

Written directly against WebGL2, every capability the specification asks for is
reached: instanced geometry, ping ponged simulation, morph targets with per
particle ordering, depth, bloom, depth of field, vignette and grain. The home
page measures 561KB of JavaScript against a ceiling of 570, and the engine's
share of that is whatever the home page carries over a route without it, which
`tests/performance.spec.ts` holds apart by asserting the two separately.

## Architecture

```
scroll ─┐
        ├─→ ParticleTimeline ─→ uniforms ─┐
pointer ┘                                 │
                                          ▼
      velocity pass  ──swap──→  position pass  ──swap──→  position texture
       (180 x 180)               (180 x 180)                     │
                                                                 ▼
                                             instanced draw, 32,400 pyramids
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
| `src/particles/targets.ts` | Packs the shapes into the nine slots of one texture, builds the parameter textures. |
| `src/particles/structures.ts` | The shapes the cloud becomes (a surface, an order book, a drape, a network), the names the page calls every shape by, and the chain of shapes a column of bands asks for. |
| `src/particles/extent.ts` | Where the body of a shape lands on the screen, measured with the shader's own transform, so the cloud can be sized to the room it has. |
| `src/particles/opening.ts` | The opening animation's schedule: the one list of times the engine, the host and the tests read. |
| `src/particles/brain-shape.ts` | Samples the brain out of the field, and derives the data field and the helix from it. |
| `src/particles/brain-anatomy.ts` | The distance field: the swept profile, the fissure, the regions, the folds. |
| `src/particles/brain-profile.ts` | The traced outline. Generated; do not edit by hand. |
| `src/particles/scroll.ts` | The real bands' geometry, sides and shapes, and the seams between them, in; timeline progress out. |
| `src/particles/entrance.ts` | Where each particle waits before the opening releases it. |
| `src/particles/mouse.ts` | A screen position back into the simulation's own space. |
| `src/particles/words.ts` | Text to particle targets, for the opening animation, drawn in the page's own headline face (read off its first `h1`). |
| `src/particles/quality.ts` | What the machine can do, and what to ask of it. |
| `src/particles/ping-pong.ts` | A pair of targets, one read while the other is written. |
| `src/particles/palette.ts` | The colours of the light reading, and the parsers for the ink ones. |
| `src/components/particle-brain.tsx` | The canvas, the frame loop and five listeners, and the wait for the headline face before the opening is drawn. |
| `src/components/particle-brain-mount.tsx` | Loads it, on the home page only, and says which surface the site uses and in what pigment. |
| `src/components/hero.tsx` | The first band: where the choreography starts, and the slot a phone's cloud is drawn in. |
| `src/lib/bands.ts` | The plan: which side and which shape each band of the home page asks for. The page, the validators and the tests all read it. |
| `src/app/globals.css` | The wall on the root, the lane the layout leaves empty, and the veil over the opening. |

## The simulation

Every particle carries a position and a velocity, both in textures, both
normalised nought to one. Two full screen passes a frame:

1. **Velocity.** Reads the previous position and velocity, resolves where the
   particle should be right now by blending the two shapes the cloud is between, applies the
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

Sizes are given as a rule rather than as numbers, because the grid is
configurable and the numbers were wrong in this table within a week of being
written. `G` is `gridSize` on a desktop and `gridSizeCompact` on a phone: 180 and
120, for 32,400 and 14,400 particles.

| Texture | Size | Holds |
|---|---|---|
| position, velocity | 2G x 2G, ping ponged | Particle state, in the lower left quarter |
| targets | 3G x 3G | Up to nine shapes, one to each G x G slot of a three by three grid |
| scale | 3G x 3G | Per particle size, per shape |
| colour | 3G x 3G | Per particle colour, per shape |
| parameter 1 | G x G | Signed random, row helper, display order, spring offset |
| parameter 2 | G x G | Arrival orderings for the shapes in slots zero to three |
| parameter 3 | G x G | Explosion multiplier, signed random, normalised x, and the explosion's own ordering |
| parameter 4 | G x G | Arrival orderings for the shapes in slots four to seven |

The simulation only needs a quarter of its 2G x 2G target, so the passes set the
viewport to G x G and three quarters of the pixels are never shaded.

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

**The shader is told which two shapes the cloud is between, and how far.** The
three uniforms are `u_from` and `u_to`, which are slots of the target texture, and
`u_mix`. A particle reads its own coordinate in both slots and takes the ordering
of the slot it is going to, so the wave that sweeps a morph is the arrival order
of the destination, and each shape sweeps in a direction of its own
(`SWEEPS` in `targets.ts`). It used to be a fixed chain of four, one shape after
the next in a list, which was enough while the page asked for the brain and
three things derived from it. The page asks for seven in an order of its own and
goes back to the brain between them, so the timeline chooses the two.

Four of the seven are made from nothing but a seed. A shape derived from the
brain's own coordinates keeps every particle near where it was, which is gentle
and is why the data field read as a tilted disc: a morph from one blob to another
barely moves. These start every particle somewhere else in the room, so a morph
is a swarm re-forming.

## The brain

Procedural, but the silhouette is not invented. Three attempts at inventing it
produced a smooth loaf, and the reason is structural rather than a matter of
tuning: a brain's outline is not smooth. The frontal pole bulges forward, the
occipital comes to a blunt point, the temporal lobe hangs as a distinct hook
below a deep notch, and the whole edge is bumpy with gyri. None of that survives
being approximated by a quadric.

So `src/particles/brain-profile.ts` holds ninety two points traced off plate 728
of Gray's Anatomy, which is out of copyright. `scripts/trace-brain-outline.ts`
decodes the plate, floods the background, opens the mask, takes the largest
component, walks the boundary and simplifies it; `npm run trace:brain`
regenerates the file, and `scripts/reference/SOURCE.md` records where the plate
came from. `brain-anatomy.ts` sweeps that outline into a solid: a rounded
intersection of the traced prism and a slab whose half width varies along the
length, with the longitudinal fissure cut back out of the top.

### The folds are geometry

This is the part that took three rebuilds to get right, so it is worth being
explicit about what fails.

`baseDistance` gives the smooth solid. The sampler then displaces it by the fold
field, so a gyral crown stands proud of the smooth surface by `FOLD_DEPTH`,
about a twentieth of the half length, which is the real ratio:

```ts
const folded = distance - FOLD_DEPTH * phase;
if (folded > 0 || folded < -SKIN) continue;
```

**The fold field has to be coherent through the brain's depth.** The particles
are drawn with additive blending and no depth test, so the far surface shines
through the near one. Any pattern that varies across the width gives the two
surfaces different grooves at the same screen position, each fills in the
other's, and the cortex reads as an even fuzz however deeply the sulci are
emptied. Three constructions were tried and each fails for its own reason:

- **Isotropic 3D noise** varies across the width, so the two surfaces cancel.
- **Depth into the profile** is coherent, but monotonic inward, so its bands are
  nested: a contour map, not a cortex.
- **Ridged noise** wanders and branches, but value noise varies too slowly for a
  ridge to be thin, so the ridges come out as broad irregular patches.

What works is the gap between successive level sets of a field that wanders:
take a smooth field of x and y, multiply by `FOLD_BANDS` and keep the fractional
part. The bands follow the field's contours, which meander, close on themselves
and branch at every saddle, and depending on x and y alone keeps them identical
on both hemispheres so they reinforce through the depth instead of cancelling.
`FOLD_STRETCH` compresses the field along the length so the level sets run front
to back, which is the direction gyri actually run on the lateral surface.

**A fold has to displace, not just remove.** Before this, the fold field existed
only as a rule about which particles to throw away, painted over a surface that
was perfectly smooth. A stencil has no relief, catches no light differently and
moves the surface nowhere, which is exactly why it read as texture rather than
as structure.

### The named sulci, and a fissure that is not a hole

Uniform folding everywhere makes a walnut. What makes a folded mass read as a
brain in a lateral view is that its folds are interrupted by clefts that are
deeper and longer than any gyrus and always run the same way: the **lateral
(Sylvian) fissure** and the **central sulcus**, which between them divide the
frontal, parietal and temporal lobes. Both are polylines in the same profile
coordinates as the traced outline, placed against it rather than by eye on a
rendered frame, and `foldOffset` composes them with the gyral banding into a
**signed** offset: one is the crown of a gyrus, nought the floor of an ordinary
sulcus, and a negative value is below the smooth solid's own surface, which is
the only way to say "cut in" in a scheme where the folds are otherwise all
relief.

The **longitudinal fissure** is separate, carved into `baseDistance` as a groove
down the midline from above, deep at the crown and closing before the base
because the hemispheres are joined underneath. It was 0.045 wide, which in a
cloud of ten thousand is about one particle across.

**The first version emptied the clefts of particles and the silhouette guard
caught it**, dropping from 93.6% to 86.1% overlap with the traced outline. The
guard was right, and the model was wrong: a fissure is not a hole. It is a slit
the cortex folds down into, its two banks pressed together, and in projection
there is no gap at all, only a groove. So the **displacement** follows the signed
offset and the **density** follows the gyral banding alone, which is why
`foldPhase` and `foldOffset` are two functions rather than one.

The validator had to learn the same thing. It reconstructs the surface to decide
which particles are on the skin, and through `foldPhase` alone every particle on
the wall of the lateral fissure reads as interior: the skin check failed at 85%
while the shape was exactly right. A validator that reconstructs a surface has to
reconstruct all of it.

### Density, and why the sulci are thinned rather than cut

A skin of `SKIN` deep carries most of the particles, a counted `INTERIOR_SHARE`
is scattered deeper so the cloud is hollow rather than empty when it turns, and
`STRAY_SHARE` drifts outside so the silhouette has an atmosphere rather than an
edge.

The interior share is **counted, not a per candidate probability**. As a
probability it was unpredictable, because the number of candidates is set by the
volume they are drawn from: this brain's interior is about five times the volume
of its skin, so a per candidate rate of one in twenty put one particle in five
inside.

Sulci are thinned by a ramp, `random() > phase ** SULCUS_THINNING`, rather than
cut by a hard floor. The reference has particles in its grooves: what makes a
fold read there is the contrast between a dense bright crown and a sparse dim
floor, not an absence. A hard cut also chewed lumps out of the silhouette
wherever a sulcus ran off the edge.

### Relief reaches the renderer

Each particle carries a `relief` value, nought in the floor of a sulcus and one
on a crown, and it drives **both** the particle's size and its place on the
colour ramp (`RELIEF_SHARE` in `targets.ts`). Driving only the size was the
original mistake: a crown and the floor of the sulcus beside it came out the
same colour, and the corrugation the sampler had gone to such trouble to build
was flattened back out at the last step.

Colour cannot come from relief alone either, which was the first thing tried:
once the sulci are thinned most surviving particles are near a crown, so the
value is near one everywhere and the cloud collapses to one end of the ramp. It
is mixed with a slow regional field.

### Density is a design parameter

Measured over the brain's own bounding box in a rendered frame, ten thousand
particles put colour on 22.4% of it and left the other three quarters black. A
cortex cannot read as a surface out of that, whatever the folds underneath are
doing, and it is why the corrugation showed in a flat point plot of the same
data and disappeared the moment the engine drew it. Twenty two and a half
thousand takes it to 42.9%. The bloom threshold and the colour factor came down
with it, because additive blending means a denser cloud is a brighter one.

### What is asserted

`npm run check:brain` runs as part of `npm run lint`, from seed 1337, and
prints a checksum so a change to the shape shows up as a changed number rather
than as a silently different brain. It asserts the texture dimensions the
shaders assume, no NaN or Infinity, everything in range, every ordering a true
permutation, no collapsed slot, the colour ramp reaching both ends, and the
things worth naming:

- **The cloud is a skin**, measured by putting each particle back into the
  distance field and asking how deep it is. It has to be measured against the
  *folded* surface: against the smooth solid, three quarters of the cortex reads
  as dust drifting outside the brain. An earlier version bucketed directions and
  compared each particle to the furthest in its own bucket, which is the right
  question for a displaced sphere and the wrong one for a shape with a groove in
  it, because a particle in the depth of the lateral sulcus is a long way inside
  the outer hull along its own direction while being exactly on the surface.
- **The surface is corrugated.** The outermost particles are spread across a
  range of depths in the *unfolded* field, and that range is the fold depth. On
  a smooth ball it would be nought. Every other assertion in the file passes for
  a smooth ball with a stencil over it, which is what the cortex was.

- **The hemispheres are parted**, measured as the notch the longitudinal fissure
  cuts in the crown: how far the top of the midline band falls below the top of
  the band beside it. Not as an absence of particles, which is the version that
  was written first and failed a working fissure at 91%. A fissure has walls and
  the walls carry cortex, so the midline is nearly as dense as the band beside
  it; what a fissure does to the *shape* is lower the surface along the midline.
  Swept, the notch is 0.078 at a half width of 0.062, 0.141 at 0.075, and 0.660
  at 0.090, where the fissure has stopped parting the hemispheres and started
  severing them.
- **The named sulci are cut into the cortex**, measured in the cloud rather than
  in the function that made it. Asserting that `landmarkPhase` returns one on its
  own polyline would be asserting arithmetic; what can actually go wrong is the
  sampler dropping the walls or the offset never reaching the surface, and both
  leave the field perfectly correct and the brain smooth.
- **The pointer parts a patch rather than most of the cloud**, as the share of
  particles inside `pointerReach` at the densest place it can be put. See
  [The pointer](#the-pointer).

The silhouette guard compares the cloud against the traced profile itself,
rasterised at the cloud's own scale, rather than against a stored snapshot: the
snapshot had to be re-pasted every time a change shifted the random stream,
which meant it failed loudest exactly when the shape had not moved.

**It cannot tell a brain from a potato, and its comment says so.** An ellipse
fitted to the same outline scores 92.0% against the traced profile where the
cloud scores 93.6%, and at some resolutions higher; a boundary band scores the
ellipse higher still, because the cloud's edge is made of separate specks. The
brain's outline really is close to an ellipse by area, and what makes it read as
a brain is the temporal hook and the gyral bumps, which are a few percent of it.
What guarantees the shape is where the outline comes from, and the corrugation
assertion, which a potato fails outright.

**The four structures made from a seed are each held to the one property that
makes them what they are**, measured in the cloud and not in the function that
made it, because every shape has the same particle count inside the same radius
and a wire frame that has lost its wires is a lump of the same size. The surface
is drawn as the lines of a plot, which is how much of the cloud is in the densest
tenth of the slices cut across the strike: a ball puts a sixth of it there and the
surface about two fifths. The order book has a spread, the strip across its
middle holding fewer particles than the strips beside it. The drape is narrow at
the waist and flares to the hem. The network has hubs in it, a share of the cloud
packed into a few cells. Each of the four was run against a plain ball in its
place to check the assertion could fail, and it did. Each is also centred, out to
the standard extent, solid in all three directions, and a long way in
particles from where it was in the brain.

The data field and the helix are derived from the brain per particle rather than
generated separately, so particle four thousand is the same speck of matter in
both of them and in the brain, and that morph reads as the cloud rearranging.
The four others are not, on purpose: see Morphing.

## The pointer

The cloud parts around the cursor like a shoal of fish rather than being pushed
by a blast wave: a radial force opens the hole and a tangential one at right
angles to it makes the particles stream around the obstruction. Nothing pulls
them back, because the spring that holds the shape already does, so the hole
closes on its own as the pointer leaves.

**How much of the cloud it moves is a number, not an impression.** `pointerReach`
is in the space the shapes are built in, where the furthest particle sits at an
extent of 0.34. It was 0.18, which is 53% of the cloud's radius, and a comment in
`types.ts` called that local. Counted at the densest place a pointer can be put,
`scripts/check-brain-targets.ts` reports:

| `pointerReach` | share of the cloud inside it |
|---|---|
| 0.18 | 47.4% |
| 0.13 | 19.6% |
| 0.055 | 3.0% |
| **0.085** | **7.9%** |

0.055 went too far the other way, and that is worth recording as much as the
original fault. It answered the complaint exactly and produced a dimple a
fingertip wide in a cloud four hundred pixels across, which nobody ever finds.
What was wrong was that the pointer moved *most of the brain*, not that it moved
a lot of it, so the area stays small and the force inside it goes up.

**The force is scaled by how fast the pointer is moving.** `MouseState.delta`
had been computed, smoothed and clamped every frame since the engine was written
and read by nothing at all. A resting cursor opens its hole at the base amount;
one swept through the cloud drags a wake three times the size, and the wake
decays with the velocity rather than with a timer. The swirl takes more of the
speed than the push does, which is what reads as a wake rather than as a shove.

The falloff is squared as well. `1 - smoothstep(0, reach, gap)` is broad by
construction — still worth a fifth of full strength at two thirds of the reach —
so the influence trailed across the cloud however small the reach was set.
Squared, the displacement concentrates near the pointer and the outer half of
the reach barely moves, which is the difference between a dimple and a wave.

The pointer is smoothed twice and never used raw, and it is carried back through
the projection into the simulation's own space once a frame on the processor
rather than per particle on the card. `pointerInCloudSpace` in `mouse.ts` undoes
the field rotation in the opposite order and with the opposite sign.

`smoothstep` is undefined in GLSL when its first edge is not less than its
second. Written the other way round, `smoothstep(reach, 0.0, gap)`, this driver
returns zero for every particle: the force was wired correctly end to end and
multiplied by nothing at the last step, which is invisible in a screenshot and
survives every check that the uniforms arrived.

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

**The hand-over moves nothing.** From 6.7 seconds the held composition travels,
eased, from the middle of the screen at the words' scale to the place and size
the page opens with, read off the timeline's own targets with `peek()`. By the
hand-over at 7.9 seconds the two are the same numbers, and the brain in the
intro's texture is the same brain, at the same scale, as the page's, so the
texture swap moves no particle either. The keep-out then comes on over a
quarter of a second rather than in one frame.

It used to be claimed invisible by construction, with the brain stored shrunk
by the ratio between the words' factor and the desktop one so that the swap and
the factor change would cancel. They never did: the targets switch in a frame
and the factor eases. On a monitor the brain swelled by 1.6 and shrank back,
while still in the middle of the screen, where the keep-out cut away everything
left of the column in one frame. On a phone the ratio used the desktop factor,
so the brain ended the intro at four fifths of the screen's width and collapsed
to half that. `tests/backdrop.spec.ts` now reads the composition every frame
across the hand-over and asserts it does not move.

The veil is `.intro` in `globals.css`, and an inline script in the layout decides
before the first paint whether the animation runs at all. A reader with no
JavaScript never gets the attribute and so never gets the overlay. The script
also clears the attribute after twelve seconds as a failsafe, in case the engine
chunk never arrives.

## Depth of field

The bokeh pass defocuses by the circle of confusion the depth pass gives it:

```glsl
float confusion = clamp(abs(depth - u_focalDepth) * u_aperture, 0.0, 1.0);
```

**It was saturated for the whole life of the effect, which is the opposite of
what it looked like.** The depth pass writes a linear depth between the clip
planes, `(distance - 0.1) / 29.9`, and the camera sits ten world units back, so
a focal depth of 0.125 is a plane 3.84 units from the camera: three and a half
units in front of the nearest particle. Measured against the cloud the generator
actually produces, the particles run from 0.241 to 0.425, so every one of them
was outside the focal plane by more than the clamp. The entire cloud rendered at
maximum defocus, near surface and far surface identically.

That is not a blur. On a cloud of separate specks a twenty five tap ring at
forty texels is twenty four dim copies of every particle scattered up to forty
pixels away, which is what made the cortex read as scattered rather than folded.

The trap is that the obvious suspect is innocent: **both apertures this file has
ever carried saturate**, so turning the aperture up changes nothing at all. The
focal plane is the number that matters. It sits on the near surface now, with an
aperture chosen so the far surface lands at about nine texels while the near one
stays at nought and nothing reaches the clamp.

`scripts/check-dof.ts` runs the fragment shader's own arithmetic over the same
cloud, in `npm run lint`, and fails if the near surface stops being sharp, the
far surface stops being soft, the gap between them closes, or any part of the
cloud reaches the clamp where the aperture stops meaning anything.

## Contrast

`tests/backdrop.spec.ts` hides the page, photographs what is left (the wall and
the cloud), and asks two questions of every piece of content on screen, at eight
points down the document. The first is the rule the page is built to: is anything
but bare wall behind it? That is `markedBehind` in `tests/cloud-overlap.ts`, and it
is a distance from the wall, because chalk is lighter than the wall and soot would
be darker, and what they share is that neither is the wall. The second is the
contrast itself, against the pixels and not the styles: the ratio of each run of
text's own colour to whatever is nearest its luminance behind it
(`luminanceRangeIn`). On a flat wall the second is close to redundant, and it stays
because it reads pixels: it is the one that would notice a block that grew a
background.

**Nothing is dimmed.** There were three dimmers and a gradient painted over the
reading column, all doing one job: holding the cloud down so text laid over it
kept its contrast ratio. They worked, and they all had the same cost, which is
the fault that was reported. The brain lost brightness on whichever side the
words were, so it visibly went dim every time it changed columns.

`COLUMN_DIM`, `NARROW_DIM`, `contentDim`, `u_contentDim`, `.stage-shade`,
`.lane-shade-*` and `--lane-side` are all deleted. What replaces them is a cut.

**The final pass masks the composited cloud to its own column.** `u_maskEdge`
and `u_maskSide` say where that column is, in the same screen space the page is
laid out in, and the multiply happens after the bloom has been composited in.
Three things follow that dimming could not buy:

- **The bloom is inside the cut.** It runs five downsample levels past the last
  particle, which is why separation alone never worked: moving the cloud right
  took the headline's background from 0.49 to 0.38 and stopped. A mask does not
  care how far the light carries, because the light is removed.
- **Both columns are the same brightness**, because neither is being
  compensated for.
- **The ramp is one sided**, running from the boundary into the cloud's own
  column and never out of it, so softening the edge cannot light a word.

Dimming could not have done this at any setting. Enough dim to clear the ninety
pixel headline moved the failure to the fifteen pixel grey line beneath it,
which needs its background under 0.183 in relative luminance, a bar that even
white type would not clear.

**Crossing is the interesting case.** To change columns the cloud has to get
past the reading, and at full size there is no route across this page that is
not through a paragraph. So it contracts by `CROSS_CONTRACT`, travels along the
seam between two sections, which is the one horizontal band with no text in it,
and opens out on the other side. `u_gapCentre` and `u_gapHalf` open a strip for
exactly that, sized to the contracted cloud plus its bloom rather than to a
number picked by eye, and nought height the rest of the time.

**The opening is exempt.** `hold()` sets the mask off, because the entrance
flies in from all four edges and a column mask deletes three quarters of it:
measured, the whole frame at three tenths of a second fell from the 0.0015 the
test requires to 0.00125. It is also the right answer rather than a concession
to a test. The mask exists to keep the cloud off the reading, and during the
opening there is no reading.

**When the post chain cannot be built at all**, no float render target or a
shader that will not link, there is no final pass to run the mask in, so the
canvas element carries the same cut as a CSS clip path, from the same numbers.
Keeping text clear of the cloud is not something to leave to a fallback: a
machine that cannot build the chain is exactly the one whose reader can least
afford a paragraph printed over a light source.

This used to be described as what the low tier does, and it is not. The low tier
runs the final pass at the `"minimal"` post level, which skips the bloom and the
depth of field and keeps the tone map, the mask and the colour conversion. It
has the real mask.

One thing the suite does not measure here, deliberately. Text on its own opaque
surface (the block of carbon on the home page, the chalk sheet) is excluded from
the contrast walk, because the cloud behind it reaches the reader not at all; axe
covers that case properly, on every route, since it resolves an element's own
background. Axe cannot read the canvas, which is what the pixel measurement is for.

## Surfaces

The particles accumulate additively, which is the only way to draw thirty
thousand overlapping shards without sorting them, and an accumulation of light
can only be seen over something dark. Over a pale page the same buffer adds to
white and the cloud is simply not there. That is arithmetic, not taste, so the
final pass reads the buffer in one of three ways, chosen by
`config.surface` (`CloudSurface` in `types.ts`):

- **`light`**, the default, and what the engine did first. The buffer is light,
  with bloom, depth of field, a vignette and grain. It needs a dark page, and no
  page on this site has one now: it stays so the engine still works over black for
  a caller that wants it, and `scripts/check-dof.ts` and `scripts/check-motion.ts`
  still guard it.
- **`ink`**, one pigment, and **what the site uses**. The buffer is read as how
  much ink has been laid down:
  `coverage = (1 - exp(-mass * gain)) * keep`, so the first particles darken the
  sheet quickly and the hundredth in the same place adds almost nothing, which
  is what ink does and light does not. The pigment runs from `pale` where the
  laydown is thin to `deep` where it is heavy. Dark pigments on a pale page are a
  drawing; pale ones on a mid grey page are chalk, which is why there is no third
  kind for it. The site passes `{ kind: "ink", pale: "#cfccc4", deep: "#f6f4f0",
  gain: 5.2 }` from `particle-brain-mount.tsx`: chalk on the wall, and the same
  chalk on the carbon veil for the opening. The output is premultiplied, so it
  composites over either ground without the pass knowing which one it is.
- **`riso`**, two pigments, printed one after the other. The second plate samples
  the buffer again at `offset`, a few pixels off, which is the whole character of
  a duplicator, and each plate goes through a halftone screen at its own angle so
  the two do not moire.

**Overprint is arithmetic, not a blend mode.** Two inks over a sheet are filters,
not lights, so they multiply. With `P` the paper, `A` and `B` the ink colours and
`cA`, `cB` the two coverages, the colour is
`P * (1 - cA(1 - A)) * (1 - cB(1 - B))` and the alpha is
`1 - (1 - cA)(1 - cB)`. The canvas is premultiplied and the page already supplies
the paper, so the pass writes the colour less `P(1 - alpha)`: only the
difference. That is always a valid premultiplied pair, and it needs `paper` to
be the page's own colour.

**Everything is multiplied by the mask, and nothing is added after it.** Every
term past the laydown, the screen and the grain included, is proportional to it,
so a pixel the mask excludes carries no ink at all. The canvas covers the whole
page; anything with an alpha above nought outside the lane is a mark on
somebody's paragraph.

Bloom and the vignette are off on both ink surfaces. A bloom is light spilling
past what emits it, and ink that has spread past its mark is a mistake; a
vignette is a light going off at the edge of a frame, and a printed sheet does
not do that. The bloom is not computed rather than computed and zeroed, which is
twelve passes saved.

Colours are display colours, written the way a person picks them, and are not
converted: a pigment is compared against the page's own colour and written to a
canvas that is already in display space. `hexToDisplay` in `palette.ts` is the
parse; `hexToLinear` is for the light path only.

**What a page has to do.**

- **Paint the paper on the root element.** The canvas is fixed at `z-index: -10`,
  above the root's background and below every block. A wrapper with a
  background is a lid on it. This is how the first ink reading was lost.
- Keep the page's own lane, the `band-inner` and `band-lane-*` rules, because
  that is what the engine reads the mask from.
- On a phone, provide a `[data-brain-slot]`. Nothing else changes below the
  breakpoint.

**The clip fallback hides the canvas off-light.** Without a final pass there is
no conversion, and raw additive particles on a pale page are a faint grey haze
with no picture in it. A page that loses its cloud has lost a decoration; a page
that gains a haze over its reading has lost more than that.

`tests/backdrop.spec.ts` and `tests/crossing.spec.ts` measure it. On a dark page
the overlap question is brightness. Here it is distance from the wall, which is
flat, and the wall is read off the photograph as its commonest colour:
`markedBehind` in `tests/cloud-overlap.ts`.

**How legible the cloud is, is a property of the pigment and the wall, not of the
engine.** The pigment's ends are 1.57:1 against the wall where the laydown is thin
and 2.29:1 where it is heaviest, which is the most any pixel of it can be. That is
quiet by nature: it reads as a presence, not as a figure. The levers are the wall (`--wall` in
`globals.css`, no darker than text can bear) and the pigment (`pale` and `deep`,
and `gain`, which is how quickly the laydown saturates). A darker pigment such as
soot reads harder against the wall and is a different look, so it is a decision
and not a tuning.

## Scroll

Progress is counted in **bands** and is read off the real ones: band *n*'s top
reaching the top of the viewport is progress *n*, and between two tops it is the
fraction of the way between them. A band is an element with `data-band`: the hero,
each section of the home page, and each pair of projects within the work, which
makes eleven. What a band says about itself, in its markup, is which side the
cloud keeps (`band-lane-left` or `band-lane-right`) and what shape it wants to be
(`data-shape`). The plan the page is made from is `src/lib/bands.ts`, and the
engine reads the page and is not told it a second way.

This went round a circle, and then changed what it counts. It was the sections;
then, while the cloud could only be drawn on black, the whole timeline was
compressed into a pinned stage's own travel so it could be seen at all; then the
sections again, because the ink pass gave the cloud the length of the page. The
timeline over the sections was a stack of clamped ramps, each doing nothing
until the scroll entered its window, normalised by the number of gaps so that
the end of the page was six whatever it was made of. So the cloud drifted, came
apart over the whole of the work, reassembled as something else late in the
page, turned, and gathered again: the one change of shape fell after the first
two thirds of the page, and the long run of project entries had a dispersed haze
of brain behind them. It is a rule about seams now, and a seam is wherever the
page changes its mind. There is no dispersal at all: the explosion is always
nought.

**The last boundary is clamped to the furthest the page can scroll.** The
contact band is shorter than a viewport, so its top never reaches the top of
the screen. On an earlier version of the page its top began thirty six pixels
further down than the document could scroll, and the last progress was
unreachable.

Dividing scroll by document height is what the specification allows and it is
wrong here, because the bands are not equal heights: a pair of projects is
several screens and the contact band is shorter than one, so a proportional
mapping would race the cloud through the reading and dawdle over the footer.

`ScrollController.measure()` re-reads the boundaries once at startup, again when
`document.fonts.ready` resolves and whenever a band or the body changes size.
Fonts change the height of every block of text, and measuring once, before the
fonts arrive, left the timeline mapped to positions the page no longer had.

### The lane

The cloud travels down a lane the layout leaves empty for it, `--lane` in
`globals.css`, currently 40% of the viewport. `timeline.ts` derives where that is
from the field of view, the camera's distance and the same fraction, so the cloud
goes where the gap is at any screen width rather than at the one width it was
tuned on.

**Which side it is on is read off the markup, not worked out twice.** Each band
declares `band-lane-left` or `band-lane-right`, and `ScrollController.laneState()`
reports which lanes are where on the screen and where the seams between them are.

**Whether there is a lane at all is one breakpoint, 1100 pixels**, for the bands'
lane padding, the hero's two columns and the engine, which reads it through
`matchMedia` rather than working it out. It was three: a pinned stage collapsed
at 1024 pixels, the bands at 1100 and the engine at an aspect ratio of 1.22, so
at 1099 by 800 the stage was pinned beside a column the bands had collapsed and
the cloud was cut to it over a full width column of text. The stage is gone and
the number is still one: a test asserts the layout and the engine agree either
side of the breakpoint.

The sides were worked out twice once, as a stack of ramps in `timeline.ts`, and
the two disagreed. The ramps were a guess about where each section sits in the
progress range, and the sections are nothing like equal heights. At 85% of the
document the layout had put its content on the right and the cloud was on the
right with it, over the words. Three separate tunings moved that number by a few
hundredths each before the cause turned out to be that there were two statements
of the same fact.

### The chain of shapes

The page asks for a shape per band, and the cloud is the shape of the band it is
beside. Neighbouring bands that want the same shape are one link, because nothing
changes between them, so the eleven bands are a chain of eleven shapes with ten
changes in it: the brain, a surface, a data field, an order book, a network, a
helix, the brain, a surface, a drape, a network and the brain. `chainOf` in
`structures.ts` makes it, and the engine, the validators and the tests all make
it through that one function, so they cannot disagree about what counts as a
change.

The cloud's place along the chain is a number. At rest in a band it is that
band's link. In the middle of a crossing it is the link above the seam plus the
fraction the crossing has gone, eased, so the shader is handed the two shapes
either side of the seam and how far the cloud is between them (see Morphing).

Each shape has a turn of its own, in `VIEWS` in `timeline.ts`, because a shape is
only what it is from a direction: a surface is a line seen edge on, and a helix
seen end on is a ring. The turns are from **facing the camera**, and not from the
page's own axes. The cloud is a long way to one side of the middle of the screen,
so the camera sees it from the side, and perspective acts on the whole of its
position: the columns of the order book, a few pixels apart, were closed up into a
solid wedge by the angle the camera sees them at, and the two strands of the helix
into a coil. Every shape but the brain is first turned to face the camera from
where the cloud is (`gaze` in `targets()`), and its view is the turn from there.
Views are written for the right hand lane and mirrored in the left, so a shape
turns towards the middle of the screen in either and the helix, which is in both,
is the same helix. Drawn through the shader's transform, the order book's bars are
columns again and the helix is two strands crossing.

The brain's turn is the page's own, from the world and not from the camera: the
opening profile and a quarter turn away from it as the hero leaves, so the cloud
is seen to be a solid. Each time it comes back it has a view of its own, which is
which time it is: a tenth of a turn further from the profile and from a little
above for the about band, and the opening profile again for the contact band, so
the page closes on the picture it opened with. Further round than that it stops
reading as a brain: at three tenths of a turn it is an oval with a shadow, and
seen end on, which is where the hero's turn leaves it, it is a rounded box. How wide and how tall a shape comes out at its turn is not written
down anywhere: it is measured, every time the cloud is sized (see Sizing).

### Changing columns

The cloud changes sides on a **seam**, the band of padding between two bands
whose lanes differ, because that is the one road across the page with no text on
it. The page has six: after each pair of projects but the last, and either side
of the path and the tools. Three more seams change only the shape, where two
bands share a side. Three things make a crossing true rather than approximately
true.

**The crossing is geometric.** It starts when the seam coming up the screen is
0.16 of the window below the cloud's own height, is halfway when the seam is at
that height, and is over when the seam is as far above. It used to be a stretch
of each section's progress, 0.38 to 0.72, which put the crossing in the right
place on one screen size: measured at 1920 by 1080 the seam had already passed
above the cloud when the crossing began.

**The screen is split where the lane changes.** Two bands with their content on
opposite sides are on screen together for most of a scroll past their boundary,
and the keep-out used to be one column for the whole screen, snapped across at the
middle of the crossing. The next band's heading came up the screen in the old
column, where the cloud still was. Now each region keeps the cloud to its own
band's column, split at the seam (`splits` and `sides` in `CloudMask`, up to three
regions), so a band's text never has the cloud behind it whichever way the page is
going. Only the seams where the side changes split the screen: where only the
shape changes the column is the same either side and there is nothing to cut.

**The cloud fits the seam it crosses on.** The strip the final pass keeps open
across the middle of the screen is the seam itself, measured off the bands'
padding, less a sixteen pixel margin and less however far the page scrolled in
the last frame: the mask is worked out in script and the compositor can be a
frame ahead of it, so a fling narrows the strip rather than letting it reach a
line. Only the strip: the cloud is sized to the seam at rest, so its size does
not follow the speed of the scroll, and in a fast one its edge is trimmed
rather than the text reached. The strip used to be sized to the cloud and its
bloom, which here is more than the seam, and let the glow out over the last line
above and the heading below.

To fit, the cloud **gathers itself up to cross**: it contracts by
`CROSS_CONTRACT`, rides to the seam, and its size is held to the seam's clear
height in the middle of the crossing, then opens out again past it. Where only
the shape changes it does not ride anywhere. It draws in a little, by
`MORPH_CONTRACT`, and re-forms in place, which is what lets a change of shape
read as the cloud re-forming and not as one picture replaced by another.
`scripts/check-motion.ts` finds the halfway point of every crossing, since it
depends on the cloud's height, and asserts every particle there is inside the
seam, for each of the two shapes it is between: across twenty four crossings the
worst is 0.85 of the seam's clear half.

`tests/crossing.spec.ts` stands at all six crossings with the seam at six heights
on the screen, from well below the cloud to well above it, and asserts nothing on
the page has the cloud behind it at any of them. It also moves the page forty
pixels a frame across a seam, with and without reduced motion, and asserts the
strip is narrowed by exactly that while the page moves and by nothing once it
stops. `tests/bands.spec.ts` asserts the markup is the plan, that the work is
five bands of two alternating sides, and that stood in the middle of each band the
engine has the cloud on that band's side and in that band's shape.

### Sizing: how large the cloud is, and the room it has

How large the cloud is drawn is the layout's to say and not the device's: a
window with a lane has the lane's size, `factorLane`, and one without has the
slot's, `factorSlot`. See Devices for why it used to be the other way round.

Whatever size that is, **it is then fitted to the room, and the room is
measured.** On a window as wide as a monitor the lane has room to spare. The
cloud's size is set in world units and a window's height is a fixed number of
them whatever its width, so the cloud is the same share of the window's height on
every screen and a share of the lane's width that depends on the window's shape.
On an iPad held on its side, which is four by three, or a browser window dragged
tall, the lane is a narrow strip and the cloud was wider than it: the final pass
cut it at the column's edge and the screen at the other, and what a reader saw was
a brain with both sides missing.

`extent.ts` projects a sample of the shape through the vertex shader's transform,
every time the timeline sizes it: scaled to the factor, turned about x then y then
z, offset, divided by the particle's own distance from the camera. It leaves out
the outermost half of one percent at each end of each axis, the thin scatter of
strays, which is the share `tests/fit.spec.ts` leaves out of a photograph.
`timeline.ts` then scales the cloud, about its centre, until the body is inside
the room, which is a box in the window's own units: the lane across, the frame
up and down, and in the middle of a crossing the seam. The lane may be filled to
`LANE_FILL`, the frame to `FRAME_FILL`. It is measured again at the size that came
out, because a smaller cloud is a shallower one and is magnified less. Three
passes land the body on the wall of its room from the inside, never past it and
never more than a fifth of a percent of the half frame short of it, measured over
every shape in both lanes at seven aspect ratios.

It is measured where the cloud is because that is the only place it can be
measured. Written down once per shape, the sizes were wrong in a way worth keeping
a record of. The first numbers were a radius, the same in every direction for every
shape, and written as the factor where the shader draws at twice the factor, so
every size was out by a half and the page's own tuning had grown to hide it. A
measurement of each shape on its own, made once, was better and wrong in a smaller
way: a helix measured at 0.87 of its lane was 1.08 of it when drawn there. The
cloud is not at the middle of the screen. It is a long way to one side of it, and
perspective acts on the whole of its position, so the near side of the cloud is
magnified and so is the distance from the middle of the screen to the cloud's
centre. Near particles are pushed outwards and far ones inwards, a shear of the
shape by its own depth, and it grows with how far from the middle of the screen
the cloud sits, so it grows with the aspect ratio. No number can be taken off a
shape on its own. It depends on where the cloud is.

`scripts/check-motion.ts` is the assertion, and it uses none of this: every
particle of every shape through its own copy of the shader's arithmetic, at nine
aspect ratios from 0.79 to 2.4, in both lanes, at four places down the page, in
every link of the chain. The body has to be inside the frame and inside its lane.
The worst is 0.93 of the half frame, which is `FRAME_FILL` (0.92) doing what it is
for with a hundredth of the validator's own sampling on top, the narrowest margin
to the lane's edge is 0.050 of the half frame, and the widest the cloud comes is
0.85 of its lane. On a phone, in a Pixel 5's slot and in the
smallest slot the timeline will draw in at all, the cloud reaches 1.04 of the
slot's core against 1.18 to its edge. It replaced a habit: the composition is a
stack of offsets and the size is the screen's, so how far the cloud reaches at a
scroll position is not something anybody holds in their head, and the habit was
to nudge a number until one screen width looked right. One screen width is not
the set of screens.

An earlier version of this check was twice as lenient as it said. It projected
at the factor where the shader draws at twice the factor, and every share it
reported was a half of what a reader would see.

`tests/fit.spec.ts` is the same question asked of photographs, on the screens
people have: seven iPads upright and on their side, a laptop, an ultrawide
monitor, a desktop window dragged tall, and a phone on its side.

### Devices

There used to be a single "is this a phone" test, a coarse pointer or a narrow
window, and it decided everything at once: how many particles to build, how large
to draw the cloud, how to turn each pyramid, how fast to morph, and whether to
listen for a mouse. A tablet has a coarse pointer, so every iPad was a phone, and
on one held in landscape, which has a lane beside its content exactly as a laptop
does, the cloud came out a sixth of the height of the screen where a laptop's is
over a third of it. Measured on an iPad mini on its side, 1133 by 744: 115 pixels
tall in a window 744 tall, against 282 on a laptop's 720.

It is two questions now, and they do not have the same answer on every machine
(`Device` in `quality.ts`):

- **`compact`** is whether the screen is small, which decides how much there is
  room for and so how much to build and draw. It is the shorter side of the
  window under 600 CSS pixels, so a phone held either way up is compact and a
  tablet held either way up is not. A compact screen builds the smaller grid and
  draws the smaller tiers.
- **`touch`** is whether the main way of pointing is a finger and nothing finer
  is attached, which decides whether there is a hover to part the cloud around.
  A tablet in a keyboard case has a trackpad as well, and for as long as it is
  there it is a pointer machine. Pointer events from a finger are ignored either
  way, because a tap is not a place to part the cloud around.

The size is neither. A tablet draws the full size cloud with the bloom pass, and
leaves the depth of field to a machine with a card to spend on it. Below 1100
pixels it draws in the slot under the controls, whose height is
`clamp(14rem, 38svh, max(20rem, 50vw))` so that a tablet's slot is not a phone's.

`tests/fit.spec.ts` asserts what the engine took each screen to be, and that the
layout and the engine agree about whether there is a lane, as well as the size.

### Below the breakpoint

A phone has no width to give the cloud a column, so it has a space instead: an
empty slot under the hero's controls, `data-brain-slot`, and the cloud is drawn
there and nowhere else. The canvas covers the page from its top to the bottom of
that slot, positioned rather than fixed, so the compositor scrolls the slot and
the cloud together and a fast flick cannot leave the light a frame behind its
space; it stops drawing once it has scrolled off the screen. The opening
animation is composed on the window, and the cloud settles into the slot before
the hand-over. On a short phone the slot runs past the fold and the cloud is
partly below it at first, never cut and never under the words; a phone held
sideways, whose slot has no room, plays the entrance and then draws nothing,
skipping the frames rather than drawing blanks. It is the brain throughout: the
other shapes are for a page with a lane to cross.

It used to keep the cloud low in a fixed canvas behind everything with the
keep-out switched off, so the controls, the heading, the table and the cards all
scrolled up over it. The contrast walk passed anyway, because a dim enough cloud
behind a word is still legible, and because on the phone project it had been
measuring the wrong pixels: its screenshot was in device pixels and its boxes in
CSS pixels. It now also asks whether anything is drawn over the cloud at all.

### Two stacking traps

Both cost a working brain and neither is visible in the markup.

**An animated opacity makes a stacking context.** The black stage had a
decoration layer holding a black plate, a gradient and a scrim, and it animated
its own opacity so it could fade with the stage. With no position and no z-index
of its own it painted in the ordinary positioned step, which is after every
negative z-index layer in the root context, so its black plate painted straight
over the cloud at -10 and the brain vanished from the page entirely. The layer is
gone with the stage, and the lesson is why the wall is painted on the root element
and why nothing between the root and the content may paint a background: anything
that does is on the cloud's side of the page. The cloud itself is outside every
wrapper, because the opening animation has to lift it above the veil and a
z-index inside a stacking context cannot escape one.

**A view timeline whose subject stops being rendered goes inactive**, and Chrome
then applies the animation's end state. The cloud's fade used to ride the
black stage's view timeline, so anything that hid the page took the cloud to nought
opacity with it — including the three tests that hide the page precisely so they
can photograph what is behind the words. All three were photographing an empty
canvas and calling it a measurement. Nothing whose visibility matters may hang
off a view timeline; the cloud fades from the timeline in `timeline.ts` instead.

## Configuration

Everything in `DEFAULTS` in `src/particles/types.ts`:

| To change | Set |
|---|---|
| Particle count | `gridSize`, `gridSizeCompact` (the count is the square) |
| Brain scale | `factorLane`, `factorSlot` |
| Particle scale | `particleScale`, `particleScaleCompact` |
| Colour palette of the light reading, which no page uses now | `RAMP`, `WARM`, `WARM_SHARE` in `palette.ts` |
| What the cloud is drawn in: light, one ink, two inks | `surface`, a `CloudSurface` in `types.ts`, and see Surfaces |
| The site's chalk: its two pigments, and how fast it saturates | `surface` in `particle-brain-mount.tsx` |
| Spring, friction | `spring`, `friction` |
| Pointer parting | `pointerReach`, `pointerPush`, `pointerSwirl`, `mouseSmoothing` |
| Entrance | `entryWindow`, `SHOW_SECONDS` in `engine.ts`, the constants in `entrance.ts` |
| Scroll sensitivity | `scrollEase`, and `MAX_BANDS_PER_SECOND` in `scroll.ts` |
| What progress is measured against | the bands of the page: `[data-band]` in the markup, and the plan in `src/lib/bands.ts` |
| Which side and which shape each band asks for | `bandPlan` in `src/lib/bands.ts`, nothing else |
| How many projects are in a band | `PROJECTS_PER_BAND` in `src/lib/bands.ts` |
| How each shape is turned | `VIEWS` in `timeline.ts` |
| How much of its lane the cloud may fill, and of the frame | `LANE_FILL` and `FRAME_FILL` in `timeline.ts` |
| How far the cloud draws in while only its shape changes | `MORPH_CONTRACT` in `timeline.ts` |
| Morph speed | `morphDelay`, `morphDelayCompact` |
| Explosion | `explosionDelay`, and the multiplier in `targets.ts` |
| Bloom | `bloomStrength`, `bloomThreshold`, `bloomRadius` |
| Bokeh | `BOKEH_FOCAL_DEPTH` and `BOKEH_APERTURE` in `post.ts`, in that order of importance |
| Grain | `grainStrength` |
| Vignette | `vignetteOffset`, `vignetteDarkness` |
| The opening's timings | `OPENING` and `OPENING_CEILING_MS` in `opening.ts`, and nothing else: the engine, the host and `scripts/check-motion.ts` read it |
| How small a screen is compact | `COMPACT_BELOW` in `quality.ts` |
| How far the cloud draws in to cross | `CROSS_CONTRACT` in `timeline.ts` |
| How near its height a seam starts a crossing | `CROSS_WINDOW` in `timeline.ts` |
| How much of a seam the crossing cloud may fill | `SEAM_FILL` in `timeline.ts` |
| The margin kept from text on a seam | `SEAM_MARGIN_PX` in `scroll.ts` |
| The mask's edge softening | `MASK_FEATHER` in `timeline.ts` |
| The phone's slot: its height, and how full the cloud draws it | `.brain-slot` in `globals.css`, `SLOT_FILL`, `SLOT_SOFT`, `MIN_SLOT_PX` in `timeline.ts` |
| When the brain starts settling into place at the end of the opening | `SETTLE_FROM` in `engine.ts` |
| Fold pattern | `FOLD_FREQUENCY`, `FOLD_BANDS`, `FOLD_STRETCH`, `FOLD_DEPTH` in `brain-anatomy.ts` |
| Cortex density | `SKIN`, `INTERIOR_SHARE`, `STRAY_SHARE`, `SULCUS_THINNING` in `brain-shape.ts` |
| How much relief colours | `RELIEF_SHARE` in `targets.ts` |

## Performance and quality

| Level | Desktop | Mobile | Post chain |
|---|---|---|---|
| high | 32,400 | 14,400 | bloom, bokeh, vignette, grain |
| medium | 14,000 | 7,000 | bloom, vignette, grain |
| low | 6,000 | 3,500 | vignette, grain |

A phone builds a smaller cloud as well as drawing fewer of it: sampling twenty
two and a half thousand particles costs a couple of hundred milliseconds of a
phone's processor, and its top tier would throw half of them away.

The level is chosen from the renderer string and the core count, then corrected
by the page's frame scheduler, which is the last rung of one ladder for the
whole page: see Integration. It may step up once on a machine with room, and
never after anything has been given up.

A lower level draws fewer instances of the same simulation. Particle index is
shuffled against position, so drawing the first six thousand gives an even
sample of the whole shape rather than one end of it.

The drawing buffer is capped by area rather than by edge, at 2.2 million pixels.

## Debugging

- `?brainQuality=high|medium|low|off` forces a level, or turns it off entirely.
  The tests use this, because a software rasteriser would otherwise be stepped
  straight down and the top path would never run.
- `?brainDebug=1` marks the host element.
- `?brainStats=1` puts a small readout in the corner: the frame rate a reader sees,
  measured here from the intervals between frames and not taken from the engine,
  the slowest frame, the quality the engine settled on, the particle count, how the
  device was classified, the layout and the position down the page. It is for a
  device nobody has to hand, so that its owner can read the numbers out or
  photograph them. It is a separate chunk, loaded only when asked for.
- Shader compilation and framebuffer failures print the full log in development
  and are silent in production, where every route is asserted console clean.

## Reduced motion, visibility and failure

- `prefers-reduced-motion: reduce` gets one settled frame, stepped to
  convergence at startup rather than animated, redrawn on scroll and resize,
  and once more when the page comes to rest: a frame drawn mid-scroll carries
  that scroll's margin in the seam, and it is not the picture to leave up.
- A hidden tab stops drawing. On return the clock does not jump.
- No WebGL2, no float render target, a shader that will not compile or a
  framebuffer the driver refuses: `createParticleBrain` returns null and the page
  keeps the bare wall it was already painting.
- A lost context shows the bare wall rather than asking for the GPU back.
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

The host decides *whether* to draw, because the host is what knows about
visibility, reduced motion and the route. Nothing that changes per frame is
React state.

It no longer owns the loop. `src/particles/frame.ts` does, and it is the only
`requestAnimationFrame` loop on the page.

There were two. This engine ran one and a gradient backdrop, since deleted,
ran another, each governing itself. Two callbacks a frame for one picture, and
two independent answers to "am I too slow", so a slow machine stepped **the
cloud** down while the decoration behind it carried on at full cost. The page
shed its subject to protect its ornament.

Now clients register with a rank, and the scheduler owns one ladder for the
whole page, in a stated order:

1. the decoration is thinned, from thirty frames a second to fifteen;
2. the decoration is dropped, and holds its last frame;
3. the cloud steps its quality down through `degrade()`, one level at a time.

**What is measured is the time between frames.** The first version of the
scheduler timed the JavaScript inside each callback instead, and it was wrong in
the way that mattered: WebGL only queues work, so on a machine whose graphics
card cannot keep up the callback returns in a millisecond or two while frames
are being dropped. It saw nothing, gave up nothing, and because the cloud's own
governor had been told to wait for it, nothing on the page adapted at all.
Driven through twenty seconds at thirty frames a second with draws that cost
nothing, it drew the backdrop six hundred times out of six hundred. The
container it was written in never showed it, because a software rasteriser
backs up into the command queue and makes the callback itself slow.

The rules that keep it from reacting to the wrong things:

- **A budget of a 20ms average**, fifty frames a second, over 45 frames.
- **Each interval counts for at most two frames' worth**, so a long frame is a
  dropped frame and nothing worse. At fifty milliseconds a burst of five slow
  frames tipped a window on its own.
- **A gap over a second is a pause**, a hidden tab or a closed lid, and not a
  frame.
- **Nothing is decided in the first second**, or for half a second after a
  change: a quality step, a resize (the cloud calls `settle()`), or a client
  joining a loop that is already running.
- **Six frames in a row over 36ms relieves a hopeless machine within those six
  frames** rather than after a whole window. The run is not reset by a window
  closing, which it was, so a run that straddled a close went unanswered.

**Nothing on the site registers as decoration now.** The gradient backdrop was
the only client of the first two rungs, and it went with the black stage it was a
background for, so on the site the ladder is one rung: the cloud steps itself
down. The scheduler keeps the other two, and its tests drive them with a stand-in
called the backdrop, on purpose: they are the only thing that proves the ordering
holds, and a decoration that joins the ladder later (it should register at thirty
frames a second, time gated, so it draws thirty times a second on a 60, 120 or
144Hz display alike, and should not join the loop at all while the opening
animation runs, or a struggling entrance would give up the decoration before it
relieved the cloud) arrives to a ladder that already behaves.

`tests/frame-budget.spec.ts` drives the scheduler with a stand-in display that
steps frame timestamps, because a frame rate cannot be measured on a machine
with no GPU. Every rule above has a test, and each of those tests was run
against the behaviour it replaced and failed there first. It also asserts the
page's structure in a browser: one frame callback in flight at a time on the
home page, and one video decoding.
