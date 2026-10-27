# Rooms: style reference
> seven rooms, one brain, three faces, one colour that never changes

**Theme:** dark, and only one kind. There is no light mode and no toggle. Every room
is dark and none of them is black.

The page is a sequence of rooms and the brain goes through all of them. The wall is
not one colour: it is the colour of the room the cloud is in, and the room changes
when the cloud changes shape, so a change of shape is a change of weather. The page
opens in midnight with the brain, goes to lagoon for the mark surface, indigo for
the estimates, ember for the order book, orchid for the network of trade, forest
for the compounding strand, comes back to midnight for the about section, and goes
through wine for the tools and orchid again for the people who vouch for the work
before it closes on midnight, the colour it opened with.

Three things do not change from room to room. Type is cream. The highlight, the
link and the result that did not hold are acid, `#d4ff3a`. And the wall is always
one flat colour, because the tests that prove the cloud is never under a word read
the wall off a photograph as its commonest colour.

Headlines are Bricolage Grotesque, wide and heavy and tight, and on the home page the
name is large enough that the screen is mostly name. What is read slowly is
Newsreader, a serif: the essays, the letter that is the about section, a caveat
set as a quotation. The work is an index with a verdict column and ten entries that
are not the same page ten times, and the brain behind it is chalk dust, tinted to
whichever room it is in.

It replaced a one-wall design (a warm grey, carbon type, Big Shoulders and Martian
Mono) that was asked to change on the grounds that the layout, the colours and the
type all felt repetitive on the way down. The brain, the opening, and the contract
between the page and the engine are exactly what they were; everything around them
is new.

## Tokens: colours

Seven rooms and four colours that are not a room's. `src/lib/rooms.ts` is the table
for the places that cannot read a stylesheet (the cloud, which tints itself, the
theme colour, the share cards, the icons) and `src/app/globals.css` has the same
seven for the page. `scripts/check-rooms.ts` runs in `npm run lint`, reads the
stylesheet back and fails if the two disagree, and works out the contrast of every
step of type against every wall.

| Room | Wall | Tone | Cloud, thin / heavy | Shape | Where |
|------|------|------|---------------------|-------|-------|
| midnight | `#0b1230` | `#8fa6ff` | `#9db1ff` / `#f5f7ff` | brain | The hero, the about section, the contact section, and `/cv`, `/privacy`, `/admin` |
| lagoon | `#06353a` | `#5ff0cf` | `#83f2d9` / `#f1fffb` | surface | Projects 1 and 2 with the index, the path, and `/path` |
| indigo | `#1c1468` | `#b9a6ff` | `#c0aeff` / `#fbf8ff` | field | Projects 3 and 4, and `/reel` |
| ember | `#4a1a08` | `#ffb36b` | `#ffbe82` / `#fff4e5` | skyline | Projects 5 and 6, and `/writing` |
| orchid | `#4a0f57` | `#ff9be4` | `#ffa8e8` / `#fff1fc` | network | Projects 7 and 8, and the endorsements |
| forest | `#0b3d27` | `#a8f07a` | `#b4f28b` / `#f8fff1` | helix | Projects 9 and 10 |
| wine | `#59102e` | `#ff9c9c` | `#ffa9a9` / `#fff2f2` | drape | The tools, and the 404 |

One room for every shape the cloud takes and one shape for every room, so a shape
that comes back brings its room back with it. An essay is in the room of the project
it is about, which is where that project's entry is on the home page: so
`marked-to-model` and `nanobook` are lagoon, `term-premium` is indigo and
`whose-inflation` is orchid.

| Name | Value | Token | Role |
|------|-------|-------|------|
| Cream | `#f4efe6` | `--cream`, `--ink` | Type, in every room |
| Acid | `#d4ff3a` | `--acid`, `--accent`, `--action`, `--flag` | The link, the highlight, the filled control and a result that did not hold. The same in every room |
| Carbon | `#121212` | `--carbon`, `--action-ink` | Type on acid, and type on paper |
| Chalk | `#f4f2ee` | `--chalk`, `--panel` | The two sheets of paper, and the cloud's pigment in the first room's veil |

The wall is `--wall`, painted on `html` and on nothing else. The room's own colour for
what is decoration is `--tone`: a numeral, a rule that lights, the dot beside the
name, the line that shows how far down the page you are. It is never the only thing
saying something. Every other colour on the site is cream, carbon or acid at an
alpha, so a grey that is not the room's own never appears. Components ask for tokens,
never for a colour, which is how a block of paper can turn the whole palette over.

| Token | In a room | Role |
|-------|-----------|------|
| `--ink` | cream | Body and headings |
| `--ink-soft` | cream at 0.9 | Paragraphs that sit beside a headline |
| `--muted` | cream at 0.74 | Captions and notes |
| `--faint` | cream at 0.66 | Labels |
| `--rule` | cream at 0.24 | A hairline. A line, not text, so it is exempt from the text ratios |
| `--rule-strong` | cream at 0.82 | The heavy hairline |
| `--glass`, `--glass-edge` | cream at 0.06 and 0.16 | A panel of the room's own light, and its edge |
| `--accent` | acid | Interactive text: links, and nothing else |
| `--accent-soft` | acid | The highlight behind a link on hover and focus |
| `--action`, `--action-ink` | acid, carbon | The filled control, one per view. Never text |
| `--pass` | cream | A result that held. Plain |
| `--flag` | acid | A result that did not. A swatch behind carbon, never a text colour |
| `--card`, `--band` | transparent | Nothing. They are tokens so that a component asking for a surface gets none rather than an opaque box laid over the cloud |
| `--panel` | chalk | A dialog |
| `--veil` | the first room's wall | The sheet over the opening animation |

### Contrast, worked out

Small text needs 4.5:1 and large text needs 3:1. These are computed by
`scripts/check-rooms.ts` for all seven rooms with the cream laid over the wall at its
alpha as the browser does it, and they are the worst of the seven. The room that is
lightest by luminance is forest, so it is the worst for nearly everything.
`tests/a11y.spec.ts` runs axe at critical, serious and moderate on every route.

| Pair | Worst ratio | Used for |
|------|-------------|----------|
| Cream on the wall | 10.72 (forest) | Everything |
| Cream at 0.9 on the wall | 8.98 (forest) | `--ink-soft` |
| Cream at 0.74 on the wall | 6.60 (forest) | `--muted` |
| Cream at 0.66 on the wall | 5.58 (forest) | `--faint`, and the lowest text on the site |
| The same four on glass | 9.14, 7.74, 5.81, 4.97 (forest) | Text in a glass panel |
| Tone on the wall | 6.82 (wine) | A numeral, an eyebrow, a label that lights |
| Acid on the wall | 10.62 (forest) | A link, a highlight |
| Cream on the lifted control | 7.30 (forest) | The second button in the hero, which is the wall with a little cream in it |
| The cloud's thin pigment on the wall | 7.48 (wine) | The cloud is not text, and it is held to 7 as well |
| The cloud's heavy pigment on the wall | 12.02 (forest) | |
| Carbon on acid | 16.2 | The `.flag` swatch, and the filled control |
| Carbon on chalk | 16.76 | The sheet, the ledger block and the dialog |
| Carbon at 0.74 and 0.7 on chalk | at least 4.5 | `--muted` and `--faint` on paper |

If a wall is ever moved it is moved darker, not lighter, and the alphas are
re-derived against it: the lighter a room is the less the quiet steps of type have
to give. See Changing a room.

## Tokens: typography

Three families, and each has one job. All three are variable fonts, so one file
covers each axis rather than a static face per weight, and all three load once in
`src/app/layout.tsx` through `next/font/google`, subset and self hosted (the content
security policy allows `font-src 'self'`, and no reader's address is handed to a
third party to render a paragraph).

**Bricolage Grotesque** is the voice of the page, `--font-bricolage`: the name, every
heading, the labels and the paragraphs. Weight 200 to 800, width 75 to 100, and an
optical size axis from 12 to 96, so small type is cut for small sizes and the name is
cut for its own. The weight axis is the reason it was chosen: the letter weight
effect has to be a real change of weight and not a smear.

**Newsreader** is for what is read slowly, `--font-newsreader`. A serif with an
optical size axis and an italic that is drawn and not slanted. The essays on their
sheet, the letter that is the about section, the caveat on a poster entry, and what
somebody else said about the work.

**JetBrains Mono** is for a line of code, `--font-jetbrains`, where code appears in an
essay.

Both fall back to the stand-ins `next/font` generates from the real faces' metrics,
which it has for all three, and `tests/performance.spec.ts` holds the page to a shift
of under 0.01 on a laptop and on a phone when the font files arrive late. There is no
hand made fallback in the stylesheet any more; the one for Martian Mono was only
there because next/font had no metrics for it.

### Type scale

| Class | Face | Size | Weight | Line height | Used for |
|-------|------|------|--------|-------------|----------|
| `.t-display-lg` | Bricolage | `clamp(4rem, min(15.5vw, 23svh), 13.5rem)`, and below 1100px `clamp(4rem, min(22vw, 26svh), 9rem)` | 700, upper case | 0.86 | The name, on the home page only. Sized by the shorter of the window's width and its height, so the controls are on the first screen on a laptop |
| `.t-hlg` | Bricolage | `clamp(3rem, 8vw, 6.5rem)` | 700 | 0.9 | A page's own title where the page is not the home page |
| `.t-h` | Bricolage | `clamp(2.5rem, 6.2vw, 5.25rem)` | 650 | 0.95 | A section's heading |
| `.figure-xl` | Bricolage | `clamp(4rem, 11vw, 9.5rem)` | 700 | 0.9 | The number that carries a project, in the room's tone |
| `.poster-headline` | Bricolage | `clamp(2rem, 4.6vw, 3.75rem)` | 650 | 1.02 | The sentence a project is about, as the biggest type on its entry |
| `.contact-mail` | Bricolage | `clamp(1.5rem, 3.9vw, 3.4rem)` | 650 | 1.05 | The address, as a headline |
| `.t-hsm` | Bricolage | `clamp(1.9rem, 3.8vw, 3.1rem)` | 650 | 1 | An entry's name, and a long-form heading |
| `.t-sub` | Bricolage | `clamp(1.375rem, 2.7vw, 2.25rem)` | 500 | 1.12 | The one sentence a section leads with |
| `.t-h3` | Bricolage | 1.25rem | 700 | 1.05 | The smallest thing that is still a heading, and the wordmark |
| `.letter` | Newsreader | `clamp(1.125rem, 1.5vw, 1.3125rem)`, and its first line `clamp(1.625rem, 2.9vw, 2.4rem)` | 400, and 450 | 1.7, and 1.22 | The about section |
| `.quote` | Newsreader | `clamp(1.25rem, 2.2vw, 1.75rem)` | 500 | 1.3 | Somebody else speaking. It changes voice instead of drawing quotation marks |
| `.longform` | Newsreader | 1.125rem | 400 | 1.7 | The essays, on the sheet. The most legible setting the site has |
| body | Bricolage | 1rem | 400 | 1.6 | Paragraphs |
| `.t-body-lg` | Bricolage | 1.125rem | 400 | 1.6 | A lead paragraph |
| `.t-caption` | Bricolage | 0.8125rem | 400 | 1.55 | Captions and notes |
| `.t-label` | Bricolage | 0.75rem | 600 | 1.35 | Labels: tracked at 0.12em, upper case, in `--faint` |
| `.t-mono` | JetBrains Mono | 0.78rem | 400 | 1.5 | A line of code, where one is needed |

Headings are set tight, at about -0.03em, because at this size the default spacing is
a gap you could park a car in, and heavy enough that a letter swelling under the
cursor has somewhere to go. The effect runs over every word on the site, to a weight
of 800 in all three faces.

## Spacing, shape and line

- **Radius is two sizes and a pill.** `--radius` is 1.25rem, for a panel of glass, a
  figure and a clip. `--radius-lg` is 1.75rem, for a sheet of paper. A control and a
  chip are fully round. Nothing is square any more, and nothing is a circle that is
  not meant to be one.
- **Depth is a few percent of cream.** A panel of glass is the room with six percent
  of cream over it and a hairline round it. There is no drop shadow anywhere; the
  only things that look like one are the ring that beats beside the name and the
  ring of light on the call to action, and both are the room's own light.
- **No gradient is a surface.** The wall is one colour, and the ones that exist are
  for function: the scrim under a caption over a moving picture (`.clip-scrim`), the
  ring of light round the call to action, and the lantern that follows the pointer,
  which is behind every block and is never under a word.
- **Lines are hairlines of cream.** `.scored` is a 1px line at `--rule-strong`;
  `.scored-thin` is a 1px line at `--rule`. They belong to the block they are in.
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

| Band | Side | Shape | Room |
|---|---|---|---|
| `hero` | right | brain | midnight |
| `work` (projects 1 and 2, with the index) | right | surface | lagoon |
| `work-2` (3 and 4) | left | field | indigo |
| `work-3` (5 and 6) | right | skyline | ember |
| `work-4` (7 and 8) | left | network | orchid |
| `work-5` (9 and 10) | right | helix | forest |
| `about` | right | brain | midnight |
| `path` | left | surface | lagoon |
| `skills` | left | drape | wine |
| `endorsements` | right | network | orchid |
| `contact` | right | brain | midnight |

The ten projects are five bands of two and the sides alternate after every pair, so
the cloud crosses the page six times and changes shape ten, and comes back to the
brain between the other shapes. The shapes in the work follow what each pair is
about: the first pair is the mark surface that broke static arbitrage, the second a
band of estimates that moves with its start date, the third an order book, the
fourth trade between countries, the fifth break even over years of compounding.
A shape is not a claim, and nothing on the page says that this is what a project
is.

This is a contract with the particle engine (`ParticleBrainREADME.md`), and these
things must hold:

- A band is an element with `data-band`: the hero, every section of the home page,
  and each pair of projects within the work. They are in the order of the plan,
  and `tests/bands.spec.ts` asserts the markup is the plan.
- The side is a class on the band: `band-lane-right` puts the lane on the right and
  the content on the left, and `band-lane-left` the reverse.
- The shape is `data-shape` on the band, one of the seven names in
  `src/particles/structures.ts`. The engine reads both off the page and is not told
  them a second way, and the room watcher reads the same attribute to choose the
  room.
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
  carried the wall colour would cover the cloud completely. A panel of glass is
  allowed because it is a few percent of cream and only ever inside the column.
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

## Rooms in practice

The home page changes room as the cloud changes shape. `RoomWatcher`
(`src/components/room-watcher.tsx`) watches for the band that is across the middle of
the window, looks up the room of that band's shape in `roomOfShape`, and sets
`data-room` on the root. The stylesheet turns that into a wall and a tone, and the
wall's own change is a 900 millisecond transition on the root's background, so a
reader who asked for less motion gets the new room at once without the watcher
knowing. It also moves the browser's theme colour with the wall and tells the cloud,
which tints itself.

The cloud takes the room's two pigments by a listener on the `fl-room` event
(`particle-brain.tsx`), moving a share of the way to them each frame with a time
constant of 0.28 seconds and handing them to the engine as `setConfig({ surface })`.
Nothing in the engine knows about rooms. A cloud that is shed down to a lower tier
is already in whichever room the watcher last announced.

Every other page is one room from top to bottom and says which in its own markup:
`RoomMarker` (`src/components/room-marker.tsx`) renders a hidden element with
`data-page-room`, and the stylesheet reads it with `html:has()`, so the wall is right
in the first paint and not after the scripts have run. The page's `viewport` export
(`roomViewport` in `src/lib/page-rooms.ts`) puts the same colour in the head, so a
phone's own chrome meets the page. After hydration the watcher reads the marker back
and sets the root's attribute, so all three agree.

| Page | Room |
|------|------|
| `/path` | lagoon |
| `/writing` | ember |
| `/writing/<essay>` | the room of the project it is about |
| `/reel` | indigo |
| not found | wine |
| `/cv`, `/privacy`, `/admin/analytics` | midnight, which is the root's own |

## Surfaces

Everything is on the wall, and anything else is a decision somebody made.

| Level | Name | Value | Where |
|-------|------|-------|-------|
| 0 | The room | the wall, per room | Every page, and nearly everything on it |
| 1 | Glass | cream at 0.06 over the room, a 1px edge at 0.16 | `.glass`: the tools, the evidence panel on a split entry, the caveat on every project but the strongest. Only inside the column the words are in |
| 2 | Paper | `#f4f2ee` | `.chalk-block`: the one inverted surface, used where a thing has to be read before anything else, which is the ledger on the home page and the caveat on the strongest project. `.sheet`, `.palette`: a poster pasted on the wall, for anything read for twenty minutes, which is the essays, the privacy page and the search dialog. The tokens turn over inside it, so the same markup is cream on the room and carbon on paper without restating a rule |
| - | Veil | the first room's wall | The sheet over the opening animation, for the eight seconds the cloud and the words are the only things on screen, lifting onto the page |

The caption over the reel's films is not a surface of its own. The scrim under it
(`.clip-scrim`) is the darkest colour on the site, laid down at a known strength, and
the caption keeps the page's own tokens, so it is cream on that and never anything
that depends on the frame behind it.

## Components

### Section
A hairline with a label under it in the room's tone, a heading, an optional lead
sentence, and the content in a container (so what is inside lays itself out against
the room the band gives it and not the window's). The line is inside the section's
own container. `level` makes it the `h1` on a page whose heading it is, and `lane`
chooses a side on the home page. Its parts arrive as the page is scrolled.

### Header and footer
The header is in the flow, above the page, and nothing else: the name with a small
light beside it that takes the colour of the room and beats slowly, the navigation as
a pill of its own with the current page filled in, and the search as a field. There is
no rule under it, and nothing in it is fixed to the window except the line that shows
how far down the page you are. The footer is a hairline, the links as arrow labels,
the one sentence that says nothing here is financial advice, and at the end of the row
of links a ghost pill, **Back To Top**, on every route. It is a button and not an
anchor to the top of the page, because it does something to the page rather than
going somewhere in it: a link would add a history entry and put a fragment in the
address bar. It scrolls smoothly and takes a reader who asked for less motion there
at once, it moves a keyboard user's focus up to the name with the page, and it does
not print. `tests/back-to-top.spec.ts` holds each of those.

### Link with arrow
`.link-arrow`. Acid, with the arrow as part of the label, and no underline at rest. On
hover **and on keyboard focus** it underlines at 2px and takes a swatch of acid with
carbon on it, so a reader who cannot hover has the same signal. Inside running prose a
link is underlined at rest, because there is no arrow to carry it.

### Control
`.pill`, `.pill-filled`, `.pill-ghost`. Fully round, 1.5px edge, set in the page's
own face, at least 44px tall. The filled one is acid with carbon on it, and there is
one per view. Hover on the filled one turns it cream and on the ghost one turns it
acid.

### The call to action
`ShinyButton`, `.shiny-cta`. The animated control Finn supplied: a pill with a ring of
light running round the edge and a field of dots masked to a sweeping arc. The
first is `.shiny-primary`, filled in acid with carbon on it and a cream ring, because
it is the one filled control in the view; the second is the room lifted a step
(`color-mix` of the wall and cream), as a solid, because the fill is one layer of a
two layer border trick and a see-through one would show the sweep behind it. It is
paused while it is off screen (`data-cta` on the root, set by the hero's observer),
because it animates a custom property and every frame is a real paint, and it holds
still for a reader who asked for less motion. It uses the page's face, not its own
import.

### The ledger
`Ledger` and `.index-table`: a table of quantity, what it is against, the
deviation and the verdict, aligned and undecorated, on a sheet of paper in the first
screen's copy column. A verdict is carried three ways at once, by the word, the
weight, and for a result that did not hold, the swatch, so that nobody needs the
colour. Below 720px it is a list of short blocks of the same four things in the same
order, and the table is `display: none`, so it is not in the accessibility tree
twice. Where it sits beside the figure that did not hold, its column is as wide as
the table is (`minmax(min-content, 1.4fr)`) and that figure takes what is left. It
was a share of the block, and at 920 and at 1550 pixels the share was 427 where the
table needs 480, so the verdict was cut off the edge.

### The index
`ProjectIndex`: the work as a listing, a number, the piece and its headline, the
one figure that carries it, what it is built with, and how far the evidence goes.
Each piece links to its entry, and the row under the pointer lights like glass with
its number in the room's tone. It scrolls inside itself below 720px, and the region
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

Ten entries in one template were ten times the same page, and that is what made the
work feel like one long block however many pictures were in it. So an entry takes one
of four compositions by its place in the list, in an order that comes round again, so
no two neighbours are alike and the ten are never more than three entries from a
change. Every composition carries everything an entry has to carry. What changes is
what the eye lands on first:

| Kind | Entries | What comes first |
|------|---------|------------------|
| `figure` | 1, 5, 9 | The number that carries the project, as large as a number can be set, in the room's tone or as the swatch if it did not hold |
| `clip` | 2, 6, 10 | The picture, wide, before anything is said about it |
| `split` | 3, 7 | The argument on one side and the evidence, in a panel of glass, on the other |
| `poster` | 4, 8 | The sentence the project is about, as the biggest type on the entry, and the caveat set as a quotation in the serif |

`kindOf(index)` in `project-entry.tsx` is the rule, and `data-kind` on the entry is
what the tests read. The strongest project's caveat is the one on paper.

### Flag and held
`.flag` is a result that did not hold: the words, on a swatch of acid, with carbon
on it, set on the words themselves and not on a table cell (on a cell the swatch
stretches down a row with a paragraph in it and reads as a rendering fault). Where it
is the big figure of an entry it is an inline block, because an inline swatch is as
tall as the font's own ascent and descent, which at a line height of 0.9 is taller
than the line and ran up into the name above and down over the caption. `.held` is a
result that did: plain, at weight 500, with the word saying so. In print the swatch
becomes weight 700 and an outline, because a pale grey says nothing and a colour
printer and a monochrome one disagree about a pale green.

### The letter
`.letter`, the about section. Serif, with the opening line as large as a headline and
the closing one pulled out with the room's own colour beside it, so the section has a
top, a body and an end and is not four paragraphs of the same weight. There is a slot
for a portrait, `portrait` in `src/lib/site.ts`, and it is `null`: the section shows
one only when Finn supplies one, with its description, and there is no stand-in face.

### The path
A rail with a dot for every place, in the room's tone, and the dates, the place and
what it taught beside it. `/path` is the same entries at length, with the asides that
do not go on the CV.

### The tools
`Skills`: each group is a panel of glass holding chips, and every chip is a pill that
takes the room's tone on its edge when it has the pointer. They also move away from
it. See the life of the page.

### Bays
`Bays`: five dashed shapes cut into the room with a number and a label, empty, with a
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
`.quote` in the serif, set large, with no marks drawn for it, the name beneath it as
a label, and the word "Cut." where an endorsement was trimmed. Each is highlighted in
acid behind carbon, the way a selection is and left that way, which is
`.highlight`, and is exactly `::selection`.

### The contact section
The address set as a headline (`.contact-mail`), a filled pill and two ghost ones, and
the same three things as a list for a reader who wants them as a list. The address
takes the acid highlight on hover and focus.

### The search dialog
`.palette`: a sheet of paper. The room behind it is dimmed by a flat colour and
nothing is blurred.

### Charts and figures
A result that did not hold is a bar of acid with its number in a `.flag` swatch
beside it, so the reading is in the text as well as the colour. A range is a track
with two marks. Every figure declares where its data came from.

## The life of the page

What makes the page feel inhabited, and what each is allowed to cost. All of it is
decoration, and none of it is ever the only thing saying something.

| What | Where | Rule |
|------|-------|------|
| The rooms | The wall and the cloud | The band across the middle of the window. 900ms on the wall, a time constant of 0.28s on the cloud |
| The light by the name | The header | A dot in the room's tone that beats every 2.8 seconds |
| How far down you are | The top edge | A 3px line in the room's tone, drawn by the scroll itself through a scroll timeline, so it costs no script. Left out where the browser cannot tie an animation to a scroll, because a line that does not move is worse than none |
| The time in Oxford | The hero's label | `LiveTime`, `Europe/London`, ticking over with the minute. Empty in the server's HTML, because the server's clock is not the reader's, and aria-hidden, because a clock that changes under a screen reader is noise |
| The lantern | Behind the page | A soft pool of the room's tone that follows the pointer, moved by a transform. Rank 1050 on the frame ladder |
| Letter weight | Every word | The letters near the pointer swell to a weight of 800, drawn on a layer over the page, which is never touched. Rank 1000 |
| The tools | `Skills` | Chips drift away from the pointer within 130px, by up to 26px, and settle back. Rank 1100 |
| The index | `ProjectIndex` | The row under the pointer lights |
| Arrivals | Sections and entries | A block sits 1.75rem low until it is in view and then settles. A transform and nothing else, so it is never transparent and every word is at full contrast whether it has arrived or not. Only once the document has said scripts are running (`data-js`) |

The frame ladder is the page's one frame loop (`frameScheduler` in
`src/particles/frame.ts`, which puts itself on `window.__frameScheduler`). The cloud
is rank 0 and is never rationed. Everything else joins it at a rank above 1000, and
when frames run long it is thinned and then given up, highest rank first, before the
cloud loses a particle: the chips go first, then the lantern, then the letter
weight. A decoration that asked for frames of its own would have its cost charged to
the cloud, and the cloud would be stepped down from its full count to under half of
it, and a cloud that has stepped down is never offered its particles back.

The lantern, the letters and the chips are for a pointer that hovers and not for a
reader who asked for less motion. The lantern lives inside `<main>` and the line inside
`<header>`, because the tests that photograph the wall and the cloud with the page
hidden hide those, and a pool of light that was not part of the page would be in every
one of those photographs. The letter weight overlay measures the words where they are
when it paints, so a chip or a block that moves afterwards tells it to measure again
(the `fl-moved` event, and `transitionend`), or the heavier letter would be left behind
where the word was.

## Motion

Motion is CSS wherever it can be, so no library can park an element at a hidden
transform and leave the page blank when a script is blocked. The budget is small:
rows settling once on load (`.settle-rows`, 420ms), arrivals (900ms), hover feedback at
200ms or less, the rooms (900ms), the beat beside the name, and the call to action's
light. The name is never animated: it is the first thing a reader needs, and it is
painted, not arriving.

The opening animation runs about eight seconds on a reader's first visit to `/`:
the name, then the second line (ECONOMICS, FINANCE, SOFTWARE DEV), which is held on
the screen for a second and eight tenths, then the brain, then the hand-over at 7.9
seconds, with the veil lifting over 700ms. The schedule is `src/particles/opening.ts`
and `scripts/check-motion.ts` holds the second line to its hold. Both lines are
drawn in the headline face, read off the page's own `h1` (so they are Bricolage at
weight 700, in capitals, exactly as the page's name is set), and the engine waits for
that face to arrive (up to 1.5 seconds) before it draws the words, so a slow
connection never gets them in a fallback. The page is held still while it runs, and a
Skip button, shown only while it does, ends it the way Escape does, because an iPad
has no Escape key and moving content that runs this long should be stoppable. It does
not run for a reader who asked for less motion, and it is controlled by an attribute
set before first paint so that LCP still happens on the real content. The veil is the
first room's wall, so the cloud is chalk on midnight for the seconds it and the words
are the only things on screen.

`prefers-reduced-motion: reduce` collapses every animation and transition to
nothing.

## Imagery

There is almost no imagery, and that is deliberate. The art, the photography and the
clothes are Finn's, and none of it is on the site until he supplies it with its
provenance.

- **No stock images and no generated images**, standing in for his work or for
  anything else. The bays are empty and say so, and the about section has a slot for
  his portrait and shows none until he gives one. The clips beside the projects are
  free-licence footage from before this design, each credited and linked, and each a
  placeholder for a screen recording of the thing running.
- **No brand marks, logos or assets** from the designers the look nods to.
- **No texture and no gradient on the wall.** axe cannot read text over a background
  image, and the tests read the wall as a photograph's commonest colour.
- The brain is the one picture: chalk dust drawn by the particle engine in the `ink`
  surface, tinted to the room it is in. It is the centrepiece because of what it
  does.
- The share card is the opening: the name in the headline face, in cream on midnight,
  with the engine's own brain beside it, drawn from the same generator and the same
  seed as the page's cloud and projected flat into five thousand dots in the first
  room's pigments. `src/app/og/[card]/route.tsx`. The card renderer cannot reach the
  page's fonts, so the face is vendored in `src/app/og/fonts/`, cut from the variable
  font as one static instance (weight 700, width 100, the largest optical size) with
  its SIL Open Font License, and read at build because every card is prerendered.
  `CARD_VERSION` in `src/lib/metadata.ts` is in the address of every card and is
  raised whenever one is redrawn, because link previews are cached by address for
  days.
- The icon set is the same mark in cream on midnight (`npm run build:icons`).

## Content rules

- **If a number cannot be sourced, it is not printed.** Every figure declares where
  it came from: reproduced offline from a capture committed to its repository,
  measured against real data, simulated over historical prices, the output of
  assumptions the reader sets, or a tool with no result to reproduce.
- **No availability claim.** The site does not say when, or whether, Finn is
  available or seeking work. It had a dated one once, and it went stale. `person`
  has no field for it, so TypeScript flags any use. The clock in the hero is the
  time where he is from and says nothing about whether he is free.
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
- **Acid is text only as a link, and a highlight only behind carbon.** It is at
  least 10.6:1 on every wall, so it can be read, and a swatch of it is always carbon
  on top.
- **The tone is never the only thing saying something.** It is a numeral beside a
  word, a rule beside a heading, a dot beside a name.
- **Focus is visible on everything**, a 2px acid ring at a 3px offset, and carbon
  inside paper (acid on cream is nothing). Links gain their highlight on focus as
  well as hover.
- **Controls are at least 44px tall.**
- A region that can scroll is focusable and named.
- The skip link is the first focusable element, carbon on chalk with a carbon edge
  when it appears.
- The cloud is `aria-hidden` and never takes a click, a selection or the keyboard.
  It holds still for a reader who asked for less motion, stops drawing when the tab
  is hidden, and stops when its space has scrolled off a phone's screen.
- **Print** is ink on white with the chrome removed, for the CV and the essays. Links
  print their address, and glass and paper become a bordered page.

## Do's and don'ts

### Do
- Ask for tokens, never for a colour. A component that names a hex is a component
  that will not turn over inside a sheet of paper or change with the room.
- Keep a rule inside the content's own column.
- Put the verdict in words. Then colour it.
- Use Bricolage for the page, Newsreader for what is read slowly and JetBrains Mono for
  code.
- Keep the first screen to the name, the standfirst, what it is and two controls.
- Run `npm run check:rooms` before moving a wall, and look at the brain in the room.
- Join the frame ladder at a rank above 1000 with anything that moves every frame.
- Say where a figure came from, and say what it does not show.

### Don't
- Don't use a drop shadow, a card that is opaque, or a tinted band.
- Don't set text in acid on paper, or in any colour that is not cream, carbon or acid
  at an alpha.
- Don't put a gradient or a texture on the wall.
- Don't add a fourth face, or a size that is not on the scale.
- Don't paint an opaque background between the root and the content on `/`.
- Don't put a figure or a line into the lane.
- Don't put a picture on the page that is not Finn's, or that he has not supplied.
- Don't invent a figure to fill a space.
- Don't link a private repository.

## File map

| Path | What is in it |
|---|---|
| `src/lib/rooms.ts` | The seven rooms, the shape each belongs to, and the pigments the cloud takes. For the places that cannot read a stylesheet |
| `src/lib/colours.ts` | The fixed colours, for the places that cannot read a stylesheet |
| `src/lib/page-rooms.ts` | The room of each page that is not the home page, and the head's theme colour. Server only, because it reads the band plan and the projects |
| `src/app/globals.css` | The tokens, the rooms, the type scale, the surfaces and the controls. This is where the system is enforced |
| `src/app/layout.tsx` | The three faces, the viewport's theme colour, and the chrome |
| `src/components/room-watcher.tsx`, `room-marker.tsx` | What sets the room as the cloud changes shape, and what a page says about its own |
| `src/components/section.tsx` | Hairline, label, heading, lead and container; and `Band`, which carries a section on without a heading, for the pairs of projects |
| `src/components/back-to-top.tsx` | The button at the foot of every page |
| `src/lib/bands.ts` | The plan: which side and which shape every band of the home page asks for, and how many projects a band holds |
| `src/components/hero.tsx`, `live-time.tsx` | The name, the clock, the standfirst, the controls, the ledger block |
| `src/components/ledger.tsx` | The reconstruction table, and its phone form |
| `src/components/project-index.tsx`, `project-entry.tsx` | The work as a listing and as entries, in four compositions |
| `src/components/skills.tsx`, `chip-field.tsx` | The tools as chips, and the part of them that shies from the pointer |
| `src/components/cursor-light.tsx`, `reveal.tsx` | The lantern and the arrivals |
| `src/lib/ladder.ts` | Reads the page's frame ladder from the window without bundling a second copy |
| `src/components/bays.tsx`, `src/lib/bays.ts` | The bays, and the list a piece is added to |
| `src/components/shiny-button.tsx` | The animated call to action |
| `src/components/chrome.tsx`, `nav-links.tsx`, `palette-trigger.tsx` | Header and footer |
| `src/components/intro.tsx` | The veil, the Skip button and the boot script for the opening |
| `src/components/particle-brain-mount.tsx` | Mounts the cloud on `/` and passes it the ink surface in the first room's pigments |
| `src/particles/` | The engine. See `ParticleBrainREADME.md` |
| `src/app/not-found.tsx` | A bad link, in wine |
| `src/app/manifest.ts`, `og/[card]/route.tsx`, `icon.svg` | The platform surfaces, on the first room |
| `scripts/build-icons.ts` | Generates the icon set from one mark. Run `npm run build:icons` after changing it |
| `scripts/check-rooms.ts` | The contrast of every step of type on every wall, and the stylesheet against the table |
| `tests/backdrop.spec.ts`, `cloud-overlap.ts`, `crossing.spec.ts` | The cloud never being under a word, and what the cloud is doing: its marks are measured as distance from the flat wall, read off the photograph |
| `tests/bands.spec.ts` | The markup being the plan, five pairs of projects alternating sides, and the engine reading each band's side and shape back off the page |
| `tests/rooms.spec.ts` | The wall following the cloud, every page in its room, and the head agreeing with the paint |
| `tests/fit.spec.ts` | The cloud's size on the screens people have: seven iPads upright and on their side, a laptop, an ultrawide, a window dragged tall, a phone on its side |
| `tests/widths.spec.ts` | Every route at thirteen widths from 720px to 2560px: nothing cut by the screen's edge, nothing scrolling sideways inside itself, and on the home page nothing visible in the cloud's lane |
| `tests/bays.spec.ts` | The bays against the disk, and the heading against the list |
| `tests/tables.spec.ts` | Neither table scrolling sideways at any width from 720px up: the widths that failed, the ones around them, and the screens people have |
| `tests/back-to-top.spec.ts` | The button on every route, and what it does |
| `tests/a11y.spec.ts`, `print.spec.ts`, `platform.spec.ts` | Contrast (including the call to action's label on its own fill), print, and the platform colours |
| `tests/performance.spec.ts` | Budgets, and what a late font does to the page |
| `tests/first-screen.spec.ts` | The name and both controls inside the window at five sizes |

## Changing a room

A room is its wall, its tone and its two pigments. They are in two places that cannot
read each other, `src/lib/rooms.ts` and the block for the room in
`src/app/globals.css`, and they are changed together.

1. Edit the room in both. `npm run check:rooms` fails if they differ.
2. The same command works out every step of type against the wall and fails if one is
   below its floor. The floors are well above 4.5:1 for small text, because the lowest
   step on the lightest wall is 5.58 and there is not much room to give.
3. Look at the cloud in the room. A pigment can pass its ratio and still be wrong
   for the wall: the cloud has to read as chalk in it, and the first room's pigments
   are the reference.
4. Run the contrast walk in `tests/backdrop.spec.ts` and the overlap checks in
   `tests/cloud-overlap.ts`, which measure how far each region behind a word is from
   the flat wall.

To add a room, add its name to `RoomName`, its row to `rooms`, a block to the
stylesheet that answers to both `html[data-room="name"]` and
`html:has([data-page-room="name"])`, and give it a shape or a page. Every shape has
exactly one room and every room is the room of a shape, so a new room is a new shape
in the engine first.
