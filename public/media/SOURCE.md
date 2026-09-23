# Where the media came from

Every clip here is from [Mixkit](https://mixkit.co), under the **Mixkit Stock
Video Free License**, which states:

> Items under the Mixkit Stock Video Free License can be used in your commercial
> and non-commercial projects, for free. You're permitted to download, copy,
> modify, distribute, publicly perform and broadcast the Items. Your rights are
> non-exclusive, worldwide, sub-licensable and ongoing. Attribution is not
> required, however, we would appreciate it if you credit Mixkit where
> reasonably possible.

Attribution is not required and is given anyway, because a site whose argument
is that you should be able to check where a number came from should be able to
say where its pictures came from too. The licence's own limits still apply: the
files are not redistributed here as stock, only embedded.

Each clip was chosen against the same three rules, and every poster frame was
looked at before the file was committed:

1. **No legible third-party branding.** Two otherwise good clips were rejected
   for this: Times Square at night is a wall of logos, and an aerial of glass
   towers has a Google sign on one of them.
2. **No identifiable faces.**
3. **Dark, or clean enough to earn a bright frame.** The page is black.

| Files | Mixkit ID | What it is | Page |
|---|---|---|---|
| `11-2160.mp4`, `11-1080.mp4` | 11 | Aerial view of city traffic at night: a motorway interchange from directly above, all light trails and routing | https://mixkit.co/free-stock-video/aerial-view-of-city-traffic-at-night-11/ |
| `4067-1080.mp4` | 4067 | Traffic in an underground tunnel: long-exposure light trails along a sunken motorway at dusk | https://mixkit.co/free-stock-video/traffic-in-an-underground-tunnel-4067/ |
| `42343-2160.mp4`, `42343-1080.mp4` | 42343 | Movement in a city at night, in an aerial shot | https://mixkit.co/free-stock-video/movement-in-a-city-at-night-in-an-aerial-shot-42343/ |
| `51585-2160.mp4`, `51585-1080.mp4` | 51585 | Flying over a creek full of rock | https://mixkit.co/free-stock-video/flying-over-a-relaxing-creek-full-of-rock-on-the-51585/ |

Poster frames are `<id>.jpg`, one frame from the master at 1920 wide.

## The eight added for the project cards

These sit beside a project on the home page, where a clip renders about seven
hundred pixels wide. They are 1080p, which is the right rendition at that size,
and they have no 4K file here because at that size 4K is payload nobody can see.

| File | Mixkit ID | What it is | Beside |
|---|---|---|---|
| `50748-1080.mp4` | 50748 | Screens of scrolling logs and configuration text | marked-to-model |
| `44818-1080.mp4` | 44818 | Black ink unfurling in clear water | term-premium |
| `4974-1080.mp4` | 4974 | Monochrome geometric composition, turning | deflated-sharpe |
| `18263-1080.mp4` | 18263 | Coins counted from one hand into another | honest-backtest |
| `18261-1080.mp4` | 18261 | Engraved line work on a banknote, extreme close-up | whose-inflation |
| `50998-1080.mp4` | 50998 | A roundabout from directly overhead at night | trade-mirror |
| `4352-1080.mp4` | 4352 | A street of European apartment blocks, daylight | rent-or-buy |
| `41375-1080.mp4` | 41375 | A city from high above at dusk | finance-analysis |

Each page is `https://mixkit.co/free-stock-video/<slug>-<id>/`.

**Two more were rejected on the rules above**, making four in total across this
folder. A night traffic time lapse had legible signage on a building in shot,
which is the same fault as the Google sign. A pair of hands typing on a laptop
broke no rule at all and was rejected for being the most skippable image on the
internet: washed out daylight, no subject, and the exact category of picture the
eyetracking literature says a reader's peripheral vision discards before the eye
ever lands on it.

**Two of these are honestly atmosphere rather than evidence.** Ink in water
beside a term premium reconstruction is a mood. `4352` is also the one bright
daylight frame among the eight, on a page that is otherwise black. Both are
recorded here rather than presented as if they were obvious choices, and both
are placeholders for a screen recording of the project actually running.

## Resolutions, and what is and is not 4K here

Mixkit's page offers 360p and 720p. The 4K renditions exist at
`assets.mixkit.co/videos/<id>/<id>-2160.mp4`, and three of these four have one:
genuine 3840x2160 at 24fps, which ffprobe confirms on the files in this folder.

**`4067` has no 4K rendition at all.** Its ceiling is 1080p and that is what is
here. It is not upscaled, because a 1080 frame stretched to 3840 is not 4K: it
is a larger file carrying exactly the same detail, and claiming otherwise on a
site about checking where numbers come from would be absurd.

The masters are 34 to 37 Mbps, which is a delivery format for an editor rather
than for a reader. Each is trimmed to twelve seconds, which a background loop
does not exceed and which loops better, and re-encoded at CRF 27 for the 4K
renditions and 25 for the 1080 ones. The resolution is untouched:

| | Master | Here |
|---|---|---|
| `11-2160` | 54MB | 8.7MB |
| `42343-2160` | 125MB | 9.9MB |
| `51585-2160` | 99MB | 21MB |
| `4067-1080` | 21MB | 5.3MB |

`51585` is the heaviest because it is the one daylight clip, and running water
and foliage give a codec the least to work with.

Two renditions of each, because the page uses them at two sizes. `/reel` runs a
clip the full width of the screen and gets the 4K one; beside a project a clip
renders about seven hundred pixels wide, where 4K is payload nobody can see, and
gets the 1080 one. Both load lazily, pause off screen, carry no audio, sit
behind a poster frame until played, and do not play at all for a reader who has
asked for less motion.
