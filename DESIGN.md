# Concrete: style reference
> one wall, four colours, two faces, nothing floating

**Theme:** light, and only one. There is no dark mode and no toggle.

Concrete treats the site as a wall that work is pinned to. The page is a warm mid
grey, `#a7a39b`, and everything on it is one of three other colours: carbon for
type and rules, chalk for the two surfaces that are not wall, and a single acid
yellow-green that is allowed to shout. Nothing floats. There are no cards, no
radius, no shadow and no gradient used as a surface, so the only depth on the site
is a scored line and a block of a different material. Headlines are Big Shoulders,
condensed, upper case and enormous, and on the home page the name is large enough
for the screen to crop it. Everything that is read is Martian Mono, small, wide
and spaced, the way a terminal prints a listing. The work is an index with a
verdict column rather than a grid of pictures, and the brain behind it is chalk
dust on the wall.

It came out of the three directions built for Finn to choose between (Archive,
Print room, Concrete), and he picked this one. The other two are in the history at
`b29e2b0` and nowhere in the tree.

## Tokens: colours

The four colours are the whole palette. `src/lib/colours.ts` holds the same four
for the places that cannot read a stylesheet (the viewport's theme colour, the
manifest, the share cards and the icon generator), and `tests/platform.spec.ts`
asserts that the wall there is the wall painted on the root.

The share cards (`src/app/og/[card]/route.tsx`) are the opening: the name, in
chalk, in Big Shoulders Bold, on carbon, with the page's own kicker and title in
the line under the rule. The renderer cannot reach the page's fonts, so the face
is vendored in `src/app/og/fonts/` with its SIL Open Font License, and is read at
build, because every card is prerendered.

| Name | Value | Token | Role |
|------|-------|-------|------|
| Wall | `#a7a39b` | `--wall`, `--paper` | The page. Painted on `html`, and on nothing else |
| Carbon | `#121212` | `--carbon`, `--ink` | Type, scored lines, the filled control, the inverted block |
| Chalk | `#f4f2ee` | `--chalk`, `--panel` | The sheet, the dialog, and type on carbon |
| Acid | `#d4ff3a` | `--acid`, `--flag`, `--accent-soft` | A result that did not hold, and the highlight under a link or control that has focus or a pointer on it |

Every other colour on the site is one of those four at an alpha, so a grey that is
not the wall's own never appears. The semantic tokens are what components ask
for. Components never name a colour, which is how one block can turn the whole
palette over.

| Token | On the wall | Role |
|-------|-------------|------|
| `--ink` | carbon | Body and headings |
| `--ink-soft` | carbon at 0.92 | Paragraphs that sit beside a headline |
| `--muted`, `--faint` | carbon at 0.8 | Captions and labels |
| `--rule` | carbon at 0.28 | A thin scored line. A line, not text, so it is exempt from the text ratios |
| `--rule-strong` | carbon | The heavy scored line |
| `--accent` | carbon | Interactive text: links, and nothing else |
| `--accent-soft` | acid | The highlight under a link on hover and focus |
| `--action`, `--action-ink` | carbon, chalk | The filled control, one per view. Never text |
| `--pass` | carbon | A result that held. Plain |
| `--flag` | acid | A result that did not. A swatch behind carbon, never a text colour |
| `--card`, `--band` | transparent | Nothing. They are tokens so that a component asking for a surface gets none rather than an opaque box laid over the cloud |
| `--veil` | carbon | The sheet over the opening animation |

### Contrast, worked out

Small text needs 4.5:1 and large text needs 3:1. These are computed, not eyeballed,
and `tests/a11y.spec.ts` runs axe at critical, serious and moderate on every route.

| Pair | Ratio | Used for |
|------|-------|----------|
| Carbon on wall | 7.45 | Everything |
| Carbon at 0.92 on wall | 6.64 | `--ink-soft` |
| Carbon at 0.8 on wall | 5.32 | `--muted`, `--faint`, and the lowest text on the site |
| Carbon at 0.66 on wall | 3.92 | The bay numerals only, which are large type |
| Carbon on acid | 16.20 | The `.flag` swatch |
| Carbon on chalk | 16.76 | The sheet, and the dialog |
| Chalk on carbon | 16.76 | The inverted block |
| Chalk at 0.7 on carbon | 8.54 | `--muted` inside the inverted block |
| Acid on wall | 2.17 | **Never text.** This is why a flag is a swatch |
| Chalk on wall | 2.25 | **Never text.** It is the colour of the brain |
| Chalk on acid | 1.03 | Never. Carbon is stated on `.flag` itself so a block that turns type to chalk cannot put chalk on acid |

The wall is as dark as it can be and still hold small text above 4.5:1 once the
alphas are raised. The first version of this wall had its labels at 0.66, which
axe measured at 3.9. If the wall is ever moved, it is moved lighter, not darker,
and the alphas above are re-derived against it.

## Tokens: typography

Two families, each at one end of the scale and nowhere between. A third face would
be a step in the middle of a scale whose point is that it has none. Both load once,
in `src/app/layout.tsx`, through `next/font/google`, subset and self hosted (the
content security policy allows `font-src 'self'`, and no reader's address is handed
to a third party to render a paragraph).

**Big Shoulders** is the headline face, `--font-shoulders`. Condensed, upper case
and heavy. Loaded as the variable font, so one file covers the weights 500, 600 and
700 that the scale uses. It is for anything that is a heading, a name, a lead
sentence or a quotation, and for nothing small.

**Martian Mono** is the reading face, `--font-martian`, with its width axis loaded
because the labels are set wider than the body (`wdth` 112). It is for everything
else, and it is the default on `body`.

Both are `display: swap`, so text is never invisible, and a face that arrives late
changes the page's metrics. What stands in for each while it arrives is therefore
part of the system and is made by hand in `src/app/globals.css`, from measurements
of the real faces:

- **`Shoulders Fallback`** is Arial scaled to 68.5% under weight 650 and 76.5%
  above it, with the real face's ascent and descent. Big Shoulders is about 0.69 of
  Arial's width over the text the site sets in it.
- **`Martian Mono Fallback`** is a plain monospace scaled to 119%, because every
  character of the real face is 0.714 of the size across and a monospace is 0.6, so
  the arithmetic is exact. It takes the name of the stand-in next/font generates,
  which is Arial at 157% and 21 to 24% too wide across the labels, and replaces it
  by coming later in the stylesheet with the same descriptors.
- **Measures on headline text are in `em`, never `ch`.** A `ch` is the width of a
  zero in whichever face is showing, so a box sized in them wraps the same words
  differently in the stand-in and in the real face.
- **The two labels at the top of the hero stack on a phone** and do not wrap, for
  the same reason: a row that cannot wrap does not change its mind when the face
  lands.

With the font files held back 2.5 seconds, a swap now moves the page by 0.0001 on a
laptop and 0.0005 on a phone, against 0.195 on the phone before. `tests/performance.spec.ts`
asserts under 0.01 on both projects, and asserts separately that the hand-made
Martian rule is the last one declared under the generated name, because on a
machine without Arial the generated one is never used and the difference cannot be
seen as a shift.

### Type scale

| Class | Face | Size | Weight | Line height | Used for |
|-------|------|------|--------|-------------|----------|
| `.t-display-lg` | Big Shoulders | `clamp(4.5rem, min(17vw, 24svh), 15rem)` | 700 | 0.86 | The name, on the home page only. Sized by the shorter of the window's width and a quarter of its height, so the controls are on the first screen on a laptop |
| `.t-hlg` | Big Shoulders | `clamp(3rem, 8vw, 6.5rem)` | 700 | 0.88 | A page's own title where the page is not the home page |
| `.t-h` | Big Shoulders | `clamp(2.25rem, 6vw, 4.5rem)` | 600 | 0.9 | A section's heading |
| `.t-hsm` | Big Shoulders | `clamp(1.875rem, 3.6vw, 2.75rem)` | 600 | 0.95 | An entry's name, and a long-form heading |
| `.t-sub` | Big Shoulders | `clamp(1.25rem, 2.6vw, 2rem)` | 500 | 1.05 | The one sentence a section leads with |
| `.t-h3` | Big Shoulders | 1.375rem | 600 | 1.05 | The smallest thing that is still a heading, and the wordmark |
| `.quote` | Big Shoulders | `clamp(1.125rem, 2.1vw, 1.5rem)` | 500 | 1.2 | Somebody else speaking. It changes voice instead of drawing quotation marks |
| body | Martian Mono | 0.875rem | 400 | 1.6 | Paragraphs |
| `.t-body-lg` | Martian Mono | 1rem | 400 | 1.6 | A lead paragraph |
| `.t-caption` | Martian Mono | 0.75rem | 400 | 1.55 | Captions and notes |
| `.t-label` | Martian Mono, `wdth` 112 | 0.6875rem | 400 | 1.35 | Labels: tracked at 0.16em, upper case, in `--faint` |
| `.longform` | Martian Mono | 0.9375rem | 400 | 1.75 | The essays, at 62ch. The most legible setting the site has, on the chalk sheet |

The hierarchy is the gap between the two ends, not a ladder of steps. Do not add a
size in the middle.

## Spacing, shape and line

- **Radius is zero everywhere.** Controls, blocks, the sheet, the dialog and the
  embeds are square. A rounded corner is the first thing that would put this back
  into the system it replaced.
- **There are no shadows.** Nothing is raised, so nothing is lowered. Hover
  feedback is a rule lighting up or a link gaining its acid highlight.
- **No gradient is a surface.** Two exist, both for function: the carbon scrim
  under a caption over a moving picture (`.clip-scrim`), and the ring of light
  running round the call to action.
- **Lines are scored into the wall.** `.scored` is a 2px carbon line; `.scored-thin`
  is a 1px line at the `--rule` alpha. Table headers sit on a 2px line and rows on a
  1px one. A bay and the sheet have a 2px carbon edge.
- **Space** is generous and set by `clamp`: `.section-pad` is
  `clamp(3.5rem, 8vw, 7rem)` above and below a section's content, and the gutter is
  `clamp(1.25rem, 5vw, 7rem)`. Measure is `58ch` for a paragraph (`.measure`) and
  `48ch` for a tighter one.
- **A page has a left edge and the work hangs from it.** Nothing is centred. The
  `.shell` column and a band's content both start where the name does.

## Layout, and the lane

The home page is laid out around a lane. The brain is about 370 pixels across, so
there is nowhere for it to be that is not over somebody's paragraph unless the page
gives it a column, and it does. Each band's content sits to one side and the cloud
travels down the other. Wherever two neighbouring bands differ, in side or in
shape, the cloud gathers itself up, crosses the strip of padding between them, and
arrives as what the next band asked for. Below 1100 pixels the lane collapses, and
the cloud draws inside a slot under the hero's controls instead.

The page is eleven bands, and the list they come from is `src/lib/bands.ts`, which
the page, the engine's validators and the tests all read:

| Band | Side | Shape |
|---|---|---|
| `hero` | right | brain |
| `work` (projects 1 and 2, with the index) | right | surface |
| `work-2` (3 and 4) | left | field |
| `work-3` (5 and 6) | right | skyline |
| `work-4` (7 and 8) | left | network |
| `work-5` (9 and 10) | right | helix |
| `about` | right | brain |
| `path` | left | surface |
| `skills` | left | drape |
| `endorsements` | right | network |
| `contact` | right | brain |

The ten projects are five bands of two and the sides alternate after every pair, so
the cloud crosses the page six times and changes shape ten, and comes back to the
brain between the other shapes. The shapes in the work follow what each pair is
about: the first pair is the mark surface that broke static arbitrage, the second a
band of estimates that moves with its start date, the third an order book, the
fourth trade between countries, the fifth break even over years of compounding.
A shape is not a claim, and nothing on the page says that this is what a project
is. It used to be one band down one side, and the cloud was the brain, or a haze of
it, from the first project to the last.

This is a contract with the particle engine (`ParticleBrainREADME.md`), and these
things must hold:

- A band is an element with `data-band`: the hero, every section of the home page,
  and each pair of projects within the work. They are in the order of the plan,
  and `tests/bands.spec.ts` asserts the markup is the plan.
- The side is a class on the band: `band-lane-right` puts the lane on the right and
  the content on the left, and `band-lane-left` the reverse.
- The shape is `data-shape` on the band, one of the seven names in
  `src/particles/structures.ts`. The engine reads both off the page and is not told
  them a second way.
- The engine reads the padding on each band's **first child** as the seam it has to
  change columns in. That is `.section-pad` on a section and `.band-pad` on the
  bands that continue one, which is a measurement as well as a margin. `.band-pad`
  only has padding where there is a lane: below 1100 pixels two bands of one list
  sit as the entries of a list do.
- `--lane` is `40vw` and `LANE_FRACTION` in `src/particles/timeline.ts` is `0.4`.
  They are the same number and are changed together.
- **A rule belongs to the block it is inside, never to a band**, or it runs through
  the lane under the cloud. For the same reason the header has no rule under it, and
  on the home page the footer's rule stops where the lane starts
  (`body:has(#hero) .site-footer .shell`).
- **Nothing between the root and the content paints an opaque background on `/`.**
  The canvas is fixed at `z-index: -10`, above the root's background and below every
  block, so the wall is on `html`, the body is transparent, and a wrapper that
  carried the wall colour would cover the cloud completely.
- The first screen carries the name, the standfirst and the two controls, and starts
  on what it is. The rest of the evidence arrives on the way down. The controls sit
  **beside** the standfirst from 720px and not under it, because under it they fell
  below the fold at 1280 by 720, 1366 by 768 and 657, 1536 by 730, 1100 by 700 and
  1024 by 700: the name takes most of the first screen on purpose, and anything
  stacked beneath the standfirst goes past the bottom of a laptop's window.
  `tests/first-screen.spec.ts` holds it at 1280 by 720, 1366 by 657, 1440 by 900,
  1920 by 950 and 393 by 727.
- No figure, rule or box reaches into the lane. There is deliberately no utility
  for it.

Every other route is an ordinary column: `Section` without `lane` renders in
`.shell`, because the cloud mounts on `/` only and a lane with nothing in it is a
wasted third of the screen.

## Surfaces

There are three materials. Everything is on the wall, and a block of another
material is a decision somebody made, not a default.

| Level | Name | Value | Where |
|-------|------|-------|-------|
| 0 | Wall | `#a7a39b` | Every page, and nearly everything on it |
| 1 | Carbon block | `#121212` | `.chalk-block`, `.on-carbon`: the one inverted surface, used where a thing has to be read before anything else. The reconstruction ledger on the home page, the callout on the strongest project, and the caption over the reel's film. The tokens turn over inside it, so the same markup is carbon on the wall and chalk on carbon without restating a rule |
| 2 | Chalk sheet | `#f4f2ee` | `.sheet`, `.palette`: a poster pasted on the wall, for anything read for twenty minutes. The essays, the privacy page and the search dialog |
| - | Veil | `#121212` | The sheet over the opening animation, for the eight seconds the chalk cloud and the words are the only things on screen, lifting onto the wall |

`.chalk-block` is named for the chalk type on it. It is a block of carbon.

## Components

### Section
A scored line with a label under it, a display heading, an optional lead sentence,
and the content in a container (so what is inside lays itself out against the room
the band gives it and not the window's). The line is inside the section's own
container. `level` makes it the `h1` on a page whose heading it is, and `lane`
chooses a side on the home page.

### Header and footer
The header is in the flow, above the page, and nothing else: the name in `.t-h3`,
the navigation as labels, and the search as a ruled box. There is no rule under it.
The footer is a scored line, the links as arrow labels, the one sentence that
says nothing here is financial advice, and at the end of the row of links a ghost
pill, **Back To Top**, on every route. It is a button and not an anchor to the top
of the page, because it does something to the page rather than going somewhere in
it: a link would add a history entry and put a fragment in the address bar. It
scrolls smoothly and takes a reader who asked for less motion there at once, it
moves a keyboard user's focus up to the name with the page, and it does not print.
`tests/back-to-top.spec.ts` holds each of those.

### Link with arrow
`.link-arrow`. Carbon like the text around it, with the arrow as part of the label,
and no underline at rest. On hover **and on keyboard focus** it underlines at 2px
and takes the acid highlight, so a reader who cannot hover has the same signal.
Inside running prose a link is underlined at rest, because there is no arrow to
carry it.

### Control
`.pill`, `.pill-filled`, `.pill-ghost`. Square, 2px carbon edge, set in the
terminal's voice (12px, tracked, upper case), at least 44px tall. The filled one is
carbon with chalk on it, and there is one per view. Hover is acid with carbon on it.

### The call to action
`ShinyButton`, `.shiny-cta`. The animated control Finn supplied, re-skinned for the
wall: square and carbon, with acid light running round the edge and a field of dots
masked to a sweeping arc. It is paused while it is off screen (`data-cta` on the
root, set by the hero's observer), because it animates a custom property and every
frame is a real paint, and it holds still for a reader who asked for less motion.
The glow and the inner shimmer are gone: acid over carbon at any strength worth
seeing goes to olive. It uses the page's face, not its own import.

### The ledger
`Ledger` and `.index-table`: a table of quantity, what it is against, the
deviation and the verdict, aligned and undecorated. A verdict is carried three
ways at once, by the word, the weight, and for a result that did not hold, the
swatch, so that nobody needs the colour. Below 720px it is a list of short blocks
of the same four things in the same order, and the table is `display: none`, so it
is not in the accessibility tree twice. Where it sits beside the figure that did
not hold, its column is as wide as the table is (`minmax(min-content, 1.4fr)`) and
that figure takes what is left. It was a share of the block, and at 920 and at 1550
pixels the share was 427 where the table needs 480, so the verdict was cut off the
edge.

### The index
`ProjectIndex`: the work as a listing, a number, the piece and its headline, the
one figure that carries it, what it is built with, and how far the evidence goes.
Each piece links to its entry. It scrolls inside itself below 720px, and the region
is focusable and named so a keyboard can reach the columns that are off the edge.
From 720px up it fits the column it is in. The lane leaves 605px at 1100, so the
piece's column has a floor of 11rem and not 14rem, and the gaps are tighter from
1100 to 1239 (`.index-work`); on an iPad mini on its side the last column was cut
off mid-word before that. A table that scrolls inside itself does not make the page
wider, so nothing that measured the page could have seen it, and
`tests/tables.spec.ts` measures the tables.

### An entry
`ProjectEntry`: name, headline, body, clip, stats, the interval band, **what this
does not show**, and the links. The limits are not optional and are not a footnote.

### Flag and held
`.flag` is a result that did not hold: the words, on a swatch of acid, with carbon
on it, set on the words themselves and not on a table cell (on a cell the swatch
stretches down a row with a paragraph in it and reads as a rendering fault). `.held`
is a result that did: plain, at weight 500, with the word saying so. In print the
swatch becomes weight 700 and an outline, because a pale grey says nothing and a
colour printer and a monochrome one disagree about a pale green.

### Bays
`Bays`: five squares cut into the wall with a number and a label, empty, with a
heading that counts them and says none is filled. They are the other half of the
work (painting and drawing, photography and film, 3D and code, graphic design,
archive and fashion), held open. A placeholder that was somebody else's picture is
the one thing this site argues against, so every bay is empty today.

To fill one, put the file in `public/bays/` and add a `piece` to its entry in
`src/lib/bays.ts`: the path, a description for somebody who cannot see it, and the
file's pixel size. The heading counts the filled bays from the list, so it stays
true, and `tests/bays.spec.ts` checks the file exists, has a description and a
size, and that the heading agrees with the list.

### Endorsements
`.quote` in the headline face, upper case, with no marks drawn for it, the name
beneath it as a label, and the word "Cut." where an endorsement was trimmed. No
discs, no tinted cards.

### The search dialog
`.palette`: a square sheet of chalk with a carbon edge. The wall behind it is dimmed
by a flat carbon at 0.62 and nothing is blurred.

### Charts and figures
Square marks. A result that did not hold is a bar of acid with a carbon edge (acid
alone against the wall is 2.17:1, and the edge is what makes it a shape), with its
number in a `.flag` swatch beside it, so the reading is in the text as well as the
colour. Every figure declares where its data came from.

## Motion

Motion is CSS, so no library can park an element at a hidden transform and leave the
page blank when a script is blocked. The budget is small: rows settling once on load
(`.settle-rows`, 420ms), hover feedback at 140ms, and the call to action's light.
The name is never animated: it is the first thing a reader needs, and it is painted,
not arriving.

The opening animation runs about eight seconds on a reader's first visit to `/`:
the name, then the second line (ECONOMICS, FINANCE, SOFTWARE DEV), which is held on
the screen for a second and eight tenths, then the brain, then the hand-over at 7.9
seconds, with the veil lifting over 700ms. The schedule is `src/particles/opening.ts`
and `scripts/check-motion.ts` holds the second line to its hold. Both lines are
drawn in the headline face, read off the page's own `h1`, and the engine waits for
that face to arrive (up to 1.5 seconds) before it draws the words, so a slow
connection never gets them in a fallback. The page is held still while it runs, and a Skip button, shown only while it does, ends it the way Escape does, because an iPad has no Escape key and moving content that runs this long should be stoppable. It does not run for a reader who asked for less motion, and it
is controlled by an attribute set before first paint so that LCP still happens on
the real content.

`prefers-reduced-motion: reduce` collapses every animation and transition to
nothing.

## Imagery

There is no imagery yet, and that is deliberate. The art, the photography and the
clothes are Finn's, and none of it is on the site until he supplies it with its
provenance.

- **No stock images and no generated images**, standing in for his work or for
  anything else. The bays are empty and say so.
- **No brand marks, logos or assets** from the designers the look nods to.
- **No texture on the wall.** axe cannot read text over a background image, so a
  texture would quietly weaken the accessibility gate. It can come later if he asks
  and the gate can be kept.
- The brain is the only picture: chalk dust drawn by the particle engine, in the
  `ink` surface with chalk pigments. It is the quietest of the three looks by nature
  (chalk on this wall is 2.25:1) and is the centrepiece because of what it does and
  not because of how loud it is.
- When work arrives, it goes in the bays, square, scored, captioned with a label,
  with its medium and its date. A moving clip over a caption has the carbon scrim.

## Content rules

- **If a number cannot be sourced, it is not printed.** Every figure declares where
  it came from: reproduced offline from a capture committed to its repository,
  measured against real data, simulated over historical prices, the output of
  assumptions the reader sets, or a tool with no result to reproduce.
- **No availability claim.** The site does not say when, or whether, Finn is
  available or seeking work. It had a dated one once, and it went stale. `person`
  has no field for it, so TypeScript flags any use.
- **Private repositories are never linked.** The public work links only to public
  repositories.
- **Nothing on the site or in the repository names the tools or models that helped
  write it.**
- **British spelling, and no em dashes**, in every `.ts`, `.tsx` and `.mjs` under
  `src` and `scripts`, comments included. `npm run check:voice` scans for it.
- **Some of the wording is a first draft of what Finn said, and is his to rewrite.**
  The hero's paragraph (the film, print, drawing and clothes line) and the copy
  under the Bays, each in one place.

## Accessibility

- axe at critical, serious and moderate on every route, and a 400px sideways-scroll
  check, in `tests/a11y.spec.ts`.
- **A verdict is never carried by its colour alone.** The word says it, the weight
  says it, and in print an outline says it.
- **Acid is never text on the wall.** At 2.17:1 it cannot be read at any size here.
  It is a swatch behind carbon, or a highlight behind carbon.
- **Focus is visible on everything**, a 2px carbon ring at a 3px offset, and acid
  inside a carbon block (carbon on carbon is nothing). Links gain their highlight on
  focus as well as hover.
- **Controls are at least 44px tall.**
- A region that can scroll is focusable and named.
- The skip link is the first focusable element, carbon on chalk with a carbon edge
  when it appears.
- The cloud is `aria-hidden` and never takes a click, a selection or the keyboard.
  It holds still for a reader who asked for less motion, stops drawing when the tab
  is hidden, and stops when its space has scrolled off a phone's screen.
- **Print** is ink on white with the chrome removed, for the CV and the essays. Links
  print their address, and the blocks of carbon and chalk become a bordered page.

## Do's and don'ts

### Do
- Ask for tokens, never for a colour. A component that names a hex is a component
  that will not turn over inside a block.
- Keep a rule inside the content's own column.
- Put the verdict in words. Then colour it.
- Use Big Shoulders only for headings, names, lead sentences and quotations, and
  Martian Mono for everything else.
- Keep the first screen to the name, the standfirst, what it is and two controls.
- Measure contrast against the wall before changing anything on it.
- Say where a figure came from, and say what it does not show.

### Don't
- Don't use a radius, a shadow, a card or a tinted band.
- Don't set text in acid. Don't set text in chalk on the wall.
- Don't add a third face, or a size between the ends of the scale.
- Don't paint an opaque background between the root and the content on `/`.
- Don't put a figure or a line into the lane.
- Don't put a picture on the wall that is not Finn's, or that he has not supplied.
- Don't invent a figure to fill a space.
- Don't link a private repository.

## File map

| Path | What is in it |
|---|---|
| `src/lib/colours.ts` | The four colours, for the places that cannot read a stylesheet |
| `src/app/globals.css` | The tokens, the type scale, the surfaces and the controls. This is where the system is enforced |
| `src/app/layout.tsx` | The two faces, the viewport's theme colour, and the chrome |
| `src/components/section.tsx` | Scored line, label, heading, lead and container; and `Band`, which carries a section on without a heading, for the pairs of projects |
| `src/components/back-to-top.tsx` | The button at the foot of every page |
| `src/lib/bands.ts` | The plan: which side and which shape every band of the home page asks for, and how many projects a band holds |
| `src/components/hero.tsx` | The name, the standfirst, the controls, the ledger block |
| `src/components/ledger.tsx` | The reconstruction table, and its phone form |
| `src/components/project-index.tsx`, `project-entry.tsx` | The work as a listing and as entries |
| `src/components/bays.tsx`, `src/lib/bays.ts` | The bays, and the list a piece is added to |
| `src/components/shiny-button.tsx` | The animated call to action |
| `src/components/chrome.tsx`, `nav-links.tsx` | Header and footer |
| `src/components/intro.tsx` | The veil, the Skip button and the boot script for the opening |
| `src/components/particle-brain-mount.tsx` | Mounts the cloud on `/` and passes it the chalk surface |
| `src/particles/` | The engine. See `ParticleBrainREADME.md` |
| `src/app/not-found.tsx` | A bad link, in the same wall |
| `src/app/manifest.ts`, `og/[card]/route.tsx`, `icon.svg` | The platform surfaces, on the same four colours |
| `scripts/build-icons.ts` | Generates the icon set from one mark. Run `npm run build:icons` after changing it |
| `tests/backdrop.spec.ts`, `cloud-overlap.ts`, `crossing.spec.ts` | The cloud never being under a word, and what the cloud is doing: its marks are measured as distance from the flat wall |
| `tests/bands.spec.ts` | The markup being the plan, five pairs of projects alternating sides, and the engine reading each band's side and shape back off the page |
| `tests/fit.spec.ts` | The cloud's size on the screens people have: seven iPads upright and on their side, a laptop, an ultrawide, a window dragged tall, a phone on its side |
| `tests/widths.spec.ts` | Every route at thirteen widths from 720px to 2560px: nothing cut by the screen's edge, nothing scrolling sideways inside itself, and on the home page nothing visible in the cloud's lane |
| `tests/bays.spec.ts` | The bays against the disk, and the heading against the list |
| `tests/tables.spec.ts` | Neither table scrolling sideways at any width from 720px up: the widths that failed, the ones around them, and the screens people have |
| `tests/back-to-top.spec.ts` | The button on every route, and what it does |
| `tests/a11y.spec.ts`, `print.spec.ts`, `platform.spec.ts` | Contrast (including the call to action's label on its own fill), print, and the platform colours |
| `tests/performance.spec.ts` | Budgets, and what a late font does to the page |
| `tests/first-screen.spec.ts` | The name and both controls inside the window at five sizes |

## Changing the wall

The wall is the one decision everything else is derived from, so it is changed last
and measured.

1. Change `--wall` in `src/app/globals.css` and `wall` in `src/lib/colours.ts`
   together, or `tests/platform.spec.ts` fails.
2. Re-derive the alphas for `--ink-soft`, `--muted` and `--faint` against it, so the
   lowest text stays above 4.5:1. Carbon on the wall is 7.45 now.
3. Re-run the contrast walk in `tests/backdrop.spec.ts` and the overlap checks in
   `tests/cloud-overlap.ts`, which measure how far each region behind a word is from
   the flat wall.
4. Look at the brain. Chalk on the wall is 2.25:1 and the cloud is already the
   quietest it has been. A darker wall reads better in small type and worse in the
   brain, and a lighter wall does the reverse. If the cloud stops reading as the
   centrepiece, the answer is a darker pigment for it (soot), decided by looking at
   it and not switched quietly.
