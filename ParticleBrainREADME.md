# The particle brain

A GPU particle engine: twenty two and a half thousand instanced three
dimensional pyramids whose positions and velocities live in floating point
textures, driven by a spring solver that runs entirely on the graphics card,
morphing between four shapes as the page scrolls. A phone builds eleven
thousand.

It is the opening animation, the dark band at the top of the home page, and the
cloud that goes on travelling down the page beside the writing.

The particles accumulate additively into a float target, which is the only way
to draw thirty thousand overlapping shards without sorting them, and that
accumulation is read as emitted light. It only works over black, so the site is
black: every band paints a translucent surface at most, the cloud sits behind
all of it at `z-index: -10`, and what keeps it off the words is the lane rather
than the layer.

There was briefly an ink reading of the same buffer, for when the page below the
stage was paper. It is gone with the paper, and it is in the history if the
background ever goes light again.

## Why it is written by hand

The obvious way to build this is Three.js, and the specification it was built
from names Three.js APIs throughout. It is not used here, for one measured
reason: the site's JavaScript budget is asserted in `tests/performance.spec.ts`
as uncompressed bytes on the home page, and Three.js minified is larger than
this site's entire payload was before any of this existed. Adopting it would
have roughly tripled the number the site is measured on.

Written directly against WebGL2, every capability the specification asks for is
reached: instanced geometry, ping ponged simulation, four morph targets with per
particle ordering, depth, bloom, depth of field, vignette and grain. The home
page measures 538KB of JavaScript against a ceiling of 560, and the engine's
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
| `src/particles/targets.ts` | Packs four shapes into quadrants, builds the parameter textures. |
| `src/particles/brain-shape.ts` | Samples the brain out of the field, and derives the other three shapes from it. |
| `src/particles/brain-anatomy.ts` | The distance field: the swept profile, the fissure, the regions, the folds. |
| `src/particles/brain-profile.ts` | The traced outline. Generated; do not edit by hand. |
| `src/particles/scroll.ts` | The stage's travel in, timeline progress out. |
| `src/particles/entrance.ts` | Where each particle waits before the opening releases it. |
| `src/particles/mouse.ts` | A screen position back into the simulation's own space. |
| `src/particles/words.ts` | Text to particle targets, for the opening animation. |
| `src/particles/quality.ts` | What the machine can do, and what to ask of it. |
| `src/particles/ping-pong.ts` | A pair of targets, one read while the other is written. |
| `src/particles/palette.ts` | The colours. One file, one edit. |
| `src/components/particle-brain.tsx` | The canvas, the frame loop and five listeners. |
| `src/components/particle-brain-mount.tsx` | Loads it, on the home page only. |
| `src/components/hero.tsx` | The stage: its height, its sticky panel and the two artifacts. |
| `src/app/globals.css` | The lane the layout leaves empty, the stage's scroll driven motion and the decoration layer's stacking. |

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

Sizes are given as a rule rather than as numbers, because the grid is
configurable and the numbers were wrong in this table within a week of being
written. `G` is `gridSize` on a desktop and `gridSizeMobile` on a phone: 180 and
120, for 32,400 and 14,400 particles.

| Texture | Size | Holds |
|---|---|---|
| position, velocity | 2G x 2G, ping ponged | Particle state, in the lower left quarter |
| targets | 2G x 2G | Four shapes, one per quadrant |
| scale | 2G x 2G | Per particle size, per shape |
| colour | 2G x 2G | Per particle colour, per shape |
| parameter 1 | G x G | Signed random, row helper, display order, spring offset |
| parameter 2 | G x G | Morph orderings for targets two, three and four, and the explosion |
| parameter 3 | G x G | Explosion multiplier, signed random, normalised x |

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
permutation, no collapsed quadrant, the colour ramp reaching both ends, and two
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

The other three targets are derived from the brain per particle rather than
generated separately, so particle four thousand is the same speck of matter in
every shape it passes through and a morph reads as the cloud rearranging.

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

The handover is invisible by construction: the intro's texture holds the brain
shrunk by exactly the ratio between the two factors, so the texture swap and the
factor change happen in the same frame and cancel.

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

`tests/backdrop.spec.ts` hides the page, photographs what is left, and compares
the brightest background pixel inside each run of text's own box against that
text's own colour, at eight points down the document.

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

**The low tier has no final pass**, so it carries the same cut as a CSS clip
path on the canvas element, from the same numbers. Keeping text clear of the
cloud is not something to leave to a fallback: the low tier is what a weak
machine gets, and a weak machine is exactly the one whose reader can least
afford a paragraph printed over a light source.

Two things the suite does not measure here, deliberately. Text on its own opaque
surface is excluded, because the cloud behind a card or a pill reaches the
reader not at all; axe covers that case properly, on every route, since it
resolves an element's own background. And axe in turn cannot model a sticky
ancestor: with the stage's panel stuck it walks past the white artifact cards
and reports sixteen elements as dark text on black, so the accessibility scan
neutralises that one property and touches no colour.

## Scroll

Progress runs nought to six and is read off **the real sections**: section *n*'s
top reaching the top of the viewport is progress *n*, and between two boundaries
it is the fraction of the way between them.

This went round a circle. It was the sections; then, while the cloud could only
be drawn on black, the whole timeline was compressed into the stage's own travel
so it could be seen at all; and it is the sections again, because the cloud has
the length of the page to travel down. The ink pass bought that back first, on a
white page; taking the page black keeps it for a different reason. The change
back was a deletion both times.

Two things are different from the first version:

- **Progress is normalised by the number of gaps** rather than being the section
  index itself, so moving a section to its own page does not take the last state
  off the end of the timeline. Six is the end of the page whatever the page is
  made of.
- **The last boundary is clamped to the furthest the page can scroll.** The
  contact section is shorter than a viewport, so its top never reaches the top
  of the screen: measured, it began at 16,166 pixels on a document whose maximum
  scroll is 16,130, and progress six was unreachable by thirty six pixels. The
  reassembly at the end of the timeline never played.

Dividing scroll by document height is what the specification allows and it is
wrong here, because the sections are not equal heights: measured on the home
page the work section is 10,139 pixels and the path section is 803, so a
proportional mapping would race the cloud through the reading and dawdle over
the footer.

`ScrollController.measure()` re-reads the boundaries once at startup, again when
`document.fonts.ready` resolves and whenever a section or the body changes size.
Fonts change the height of every block of text, and measuring once, before the
fonts arrive, left the timeline mapped to positions the page no longer had.

### The lane

The cloud travels down a lane the layout leaves empty for it, `--lane` in
`globals.css`, currently 40% of the viewport. `timeline.ts` derives where that is
from the field of view, the camera's distance and the same fraction, so the cloud
goes where the gap is at any screen width rather than at the one width it was
tuned on.

**Which side it is on is read off the markup, not worked out twice.** Each band
declares `band-lane-left` or `band-lane-right`, and `ScrollController.laneAt()`
reports the lane of the band the reader is in, crossing in the last fifth of a
section so the cloud is already in place when the next heading reaches the top
of the screen.

It was worked out twice, as a stack of ramps in `timeline.ts`, and the two
disagreed. The ramps were a guess about where each section sits in the progress
range, and the sections are nothing like equal heights: measured on the home
page the work section is 10,139 pixels and the path section is 803. At 85% of
the document the layout had put its content on the right and the cloud was on
the right with it, over the words. Three separate tunings moved that number by a
few hundredths each before the cause turned out to be that there were two
statements of the same fact.

### Changing columns

Which side the cloud is on is read off the markup: each band declares
`band-lane-left` or `band-lane-right` and `ScrollController.laneAt()` reports
the lane of the band the reader is in, together with how far through a change
of columns it is and where the seam between the two sections currently sits on
screen.

The crossing happens between 0.38 and 0.72 of the way through a section. It ran
0.60 to 0.95, which put it hard against the boundary and left the cloud still
moving as the next heading arrived; brought forward, it is settled well before
the incoming section fills the screen, and the seam it rides is nearer the
middle of the viewport where there is most room either side of it.

**It contracts to cross**, and that is load bearing rather than decorative. The
cloud at reading size is wider than the space between two sections, so at full
size there is no route across the page that is not through a paragraph. Drawing
itself in is what makes the seam passable. It is also the better picture: the
thing gathers itself up, crosses, and opens out again, rather than sliding
sideways behind the words.

The column term in the mask is **snapped** rather than blended. A lane number
halfway between two columns describes a boundary in the middle of the screen,
which is where the reading is. The cloud is never there: when it is between
columns it is on the seam, and the strip is what is carrying it. The snap
happens at the midpoint of the crossing, by which time the cloud is well inside
that strip.

There was a section here called "the words carry their own shade", describing a
black gradient painted over the reading column. It is gone. See **Contrast**
above for what replaced it and why.

### Nothing leaves the frame

`scripts/check-motion.ts` sweeps every quarter step of progress at four aspect
ratios, projects every shape forward with the explosion applied, and fails if
anything reaches past the frame. It reports 0.86 of the half width and 0.92 of
the half height.

That assertion replaced a habit. The explosion multiplies each particle's own
distance from the centre, so the reach at a given scroll position is not
something anybody holds in their head: measured, the burst before the contact
section reached **1.74 times the half width** and the helix went off the bottom
too. The multiplier came down from `1 + 5 * random()` to `1 + 2.2 * random()`,
and `targets()` then scales the whole composition uniformly until it fits, which
keeps its shape and its place in the lane and only changes its size on screen.

### Two stacking traps

Both cost a working brain and neither is visible in the markup.

**An animated opacity makes a stacking context.** `.stage-decoration` holds the
black plate, the gradient and the scrim, and animates its own opacity so it can
fade with the stage. With no position and no z-index of its own it painted in
the ordinary positioned step, which is after every negative z-index layer in the
root context, so its black plate painted straight over the cloud at -10 and the
brain vanished from the page entirely. It is pinned at -20 now. The cloud is
outside that wrapper, because the opening animation has to lift it above the
veil and a z-index inside a stacking context cannot escape one.

**A view timeline whose subject stops being rendered goes inactive**, and Chrome
then applies the animation's end state. The cloud's fade used to ride the
stage's view timeline, so anything that hid the page took the cloud to nought
opacity with it — including the three tests that hide the page precisely so they
can photograph what is behind the words. All three were photographing an empty
canvas and calling it a measurement. Nothing whose visibility matters may hang
off a view timeline; the cloud fades from the timeline in `timeline.ts` instead.

## Configuration

Everything in `DEFAULTS` in `src/particles/types.ts`:

| To change | Set |
|---|---|
| Particle count | `gridSize`, `gridSizeMobile` (the count is the square) |
| Brain scale | `factorDesktop`, `factorMobile` |
| Particle scale | `particleScaleDesktop`, `particleScaleMobile` |
| Colour palette | `RAMP`, `WARM`, `WARM_SHARE` in `palette.ts` |
| Spring, friction | `spring`, `friction` |
| Pointer parting | `pointerReach`, `pointerPush`, `pointerSwirl`, `mouseSmoothing` |
| Entrance | `entryWindow`, `SHOW_SECONDS` in `engine.ts`, the constants in `entrance.ts` |
| Scroll sensitivity | `scrollEase`, and `MAX_SECTIONS_PER_SECOND` in `scroll.ts` |
| What progress is measured against | `SECTIONS` and `RANGE` in `scroll.ts` |
| Stage length | the height on the section in `hero.tsx`, and the ranges in `globals.css` |
| Morph speed | `morphDelayDesktop`, `morphDelayMobile`, `secondaryMorphDelay` |
| Explosion | `explosionDelay`, and the multiplier in `targets.ts` |
| Bloom | `bloomStrength`, `bloomThreshold`, `bloomRadius` |
| Bokeh | `BOKEH_FOCAL_DEPTH` and `BOKEH_APERTURE` in `post.ts`, in that order of importance |
| Grain | `grainStrength` |
| Vignette | `vignetteOffset`, `vignetteDarkness` |
| Section timings | the `mapClamped` stacks in `timeline.ts` |
| How far the cloud draws in to cross | `CROSS_CONTRACT` in `timeline.ts` |
| Where in a section it crosses | `CROSS_FROM`, `CROSS_TO` in `scroll.ts` |
| The mask's edge softening, and the ceiling on the seam strip | `MASK_FEATHER`, `GAP_HALF_MAX` in `timeline.ts` |
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
by timing the frames: below 42fps sustained it steps down, above 56fps it may
step up once, and never after it has stepped down.

A lower level draws fewer instances of the same simulation. Particle index is
shuffled against position, so drawing the first six thousand gives an even
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
