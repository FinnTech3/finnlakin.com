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
