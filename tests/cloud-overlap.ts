import type { Page } from "@playwright/test";

/* What "nothing goes over the brain and the brain goes over nothing" means as
   a measurement, shared by every test that asks it.

   Contrast asks whether text stays legible over the cloud. This asks whether
   the cloud is behind anything at all, which is the rule the page is built to:
   the contrast measurement once passed on a phone while the brain sat behind
   the controls and the table, because a faint enough cloud behind a word is
   still legible.

   The page is one flat wall and the cloud is chalk on it, so the question is
   distance from the wall: nought is bare wall, and anything over the ceiling
   below is a mark. The wall is read off the photograph rather than passed in. It
   is the commonest colour in a frame the cloud covers a fraction of, which is
   one fewer number for a caller to get wrong, and it means the same
   measurement is right if the wall's colour is ever changed.

   Before the wall, this measured the other way up: the brightest pixel behind a
   piece of content, against a ceiling worked out from the gradient under its
   scrim, on a black page where the cloud was light. Over a pale page that is not
   a question about brightness at all. Chalk is lighter than the wall and soot
   would be darker, and what they share is that they are not the wall. */

/* Anything a reader sees as part of the page rather than as the backdrop: a run
   of words wherever it sits, a block with a surface of its own, a picture, a
   clip, an icon. */
export type ContentBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
};

/* The furthest from the wall a pixel behind a piece of content may be, as a
   share of the full range of a channel. A little under eight levels: enough
   that the edge of a glyph's own anti-aliasing against the wall is not a
   fault, and a great deal less than the weakest chalk the cloud lays down. */
export const MARK_CEILING = 0.03;

/* Every piece of content on screen, whatever it sits on. */
export function collectContent(page: Page): Promise<ContentBox[]> {
  return page.evaluate(() => {
    const found: {
      x: number;
      y: number;
      width: number;
      height: number;
      label: string;
    }[] = [];
    const view = { width: window.innerWidth, height: window.innerHeight };
    const media = new Set(["IMG", "VIDEO", "PICTURE", "CANVAS", "svg"]);
    for (const element of Array.from(
      document.body.querySelectorAll<HTMLElement>("header *, main *, footer *"),
    )) {
      /* The cloud is not content. On a page that mounts it inside itself, the
         collector would pick up the cloud's own canvas and then report that
         the cloud was behind it. */
      if (element.closest("[data-brain]")) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (Number.parseFloat(style.opacity) < 0.05) continue;
      const own = Array.from(element.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0,
      );
      const fill = style.backgroundColor.match(/-?\d+(\.\d+)?/g);
      const surface = fill ? (fill.length > 3 ? Number(fill[3]) : 1) >= 0.5 : false;
      if (!own && !surface && !media.has(element.tagName)) continue;
      const box = element.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      if (box.bottom <= 0 || box.top >= view.height) continue;
      if (box.right <= 0 || box.left >= view.width) continue;
      found.push({
        x: Math.max(0, box.left),
        y: Math.max(0, box.top),
        width: Math.min(view.width, box.right) - Math.max(0, box.left),
        height: Math.min(view.height, box.bottom) - Math.max(0, box.top),
        label: (
          (element.textContent ?? "").trim() ||
          element.getAttribute("aria-label") ||
          element.tagName
        ).slice(0, 40),
      });
    }
    return found;
  });
}

/* The window with the page hidden, which is the wall and the cloud and nothing
   else, in CSS pixels because the boxes are. The default is device pixels, which
   on the phone project is two and three quarter times as many. */
export async function photographBehind(page: Page): Promise<string> {
  await page.addStyleTag({
    content:
      /* The cloud stays. It is mounted beside the page on the site, so hiding
         the page never hid it; a page that mounts it inside itself would hide
         the thing being measured, and the photograph would come back as bare
         wall. Visibility is inherited and can be turned back on under something
         hidden, which is the one property that can express "everything but
         this". */
      "body > header, body > main, body > footer { visibility: hidden !important }" +
      " [data-brain] { visibility: visible !important }",
  });
  const shot = (await page.screenshot({ scale: "css" })).toString("base64");
  await page.evaluate(() => {
    const sheets = Array.from(document.head.querySelectorAll("style"));
    const last = sheets[sheets.length - 1];
    if (last && last.textContent?.includes("visibility: hidden")) last.remove();
  });
  return shot;
}

/* Both measurements below run in a page of their own, so this is written as a
   string and evaluated there. The alternative is passing a function, which
   Playwright would serialise per call and which cannot then be shared between
   the three of them. */
const TOOLS = `
  async function decodeShot(data) {
    const image = new Image();
    image.src = "data:image/png;base64," + data;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    return { pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
  }
  /* The commonest colour, quantised to five bits a channel. On a page printed
     on one flat sheet, that is the sheet. */
  function wallOf(pixels) {
    const counts = new Map();
    for (let i = 0; i < pixels.length; i += 4) {
      const key = ((pixels[i] >> 3) << 10) | ((pixels[i + 1] >> 3) << 5) | (pixels[i + 2] >> 3);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let best = -1;
    let mode = 0;
    for (const [key, count] of counts) {
      if (count > best) { best = count; mode = key; }
    }
    return [((mode >> 10) & 31) * 8 + 4, ((mode >> 5) & 31) * 8 + 4, (mode & 31) * 8 + 4];
  }
  function distanceFrom(pixels, i, wall) {
    return Math.max(
      Math.abs(pixels[i] - wall[0]),
      Math.abs(pixels[i + 1] - wall[1]),
      Math.abs(pixels[i + 2] - wall[2]),
    ) / 255;
  }
  function channel(value) {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function luminanceAt(pixels, i) {
    return 0.2126 * channel(pixels[i]) + 0.7152 * channel(pixels[i + 1]) + 0.0722 * channel(pixels[i + 2]);
  }
  function clampRegion(shot, region) {
    return {
      x0: Math.max(0, Math.floor(region.x)),
      y0: Math.max(0, Math.floor(region.y)),
      x1: Math.min(shot.width, Math.ceil(region.x + region.width)),
      y1: Math.min(shot.height, Math.ceil(region.y + region.height)),
    };
  }
`;

type Region = { x: number; y: number; width: number; height: number };

/* The furthest any pixel inside each region gets from the wall. Over bare wall
   this is nought, and over a mark it is not. */
export function markedBehind(decoder: Page, data: string, regions: Region[]): Promise<number[]> {
  return decoder.evaluate(
    ({ data, regions, tools }: { data: string; regions: Region[]; tools: string }) =>
      new Function(
        "data",
        "regions",
        `${tools}
        return (async () => {
          const shot = await decodeShot(data);
          if (!shot) return regions.map(() => 1);
          const wall = wallOf(shot.pixels);
          return regions.map((region) => {
            const { x0, y0, x1, y1 } = clampRegion(shot, region);
            let worst = 0;
            for (let y = y0; y < y1; y++) {
              for (let x = x0; x < x1; x++) {
                const d = distanceFrom(shot.pixels, (y * shot.width + x) << 2, wall);
                if (d > worst) worst = d;
              }
            }
            return worst;
          });
        })();`,
      )(data, regions) as Promise<number[]>,
    { data, regions, tools: TOOLS },
  );
}

/* How much of the frame carries a mark at all. A test that the cloud goes over
   nothing has to show the cloud is there, or a page that failed to draw it
   passes for the wrong reason. */
export function markedShare(decoder: Page, data: string, over = MARK_CEILING): Promise<number> {
  return decoder.evaluate(
    ({ data, over, tools }: { data: string; over: number; tools: string }) =>
      new Function(
        "data",
        "over",
        `${tools}
        return (async () => {
          const shot = await decodeShot(data);
          if (!shot) return 0;
          const wall = wallOf(shot.pixels);
          let marked = 0;
          for (let i = 0; i < shot.pixels.length; i += 4) {
            if (distanceFrom(shot.pixels, i, wall) > over) marked += 1;
          }
          return marked / (shot.pixels.length / 4);
        })();`,
      )(data, over) as Promise<number>,
    { data, over, tools: TOOLS },
  );
}

/* The darkest and the lightest relative luminance inside each region. What a
   piece of text has to be read against is whichever of the two is nearest its
   own, so a contrast check needs both: dark type is worst off against the
   darkest thing behind it and light type against the lightest. */
export function luminanceRangeIn(
  decoder: Page,
  data: string,
  regions: Region[],
): Promise<{ min: number; max: number }[]> {
  return decoder.evaluate(
    ({ data, regions, tools }: { data: string; regions: Region[]; tools: string }) =>
      new Function(
        "data",
        "regions",
        `${tools}
        return (async () => {
          const shot = await decodeShot(data);
          if (!shot) return regions.map(() => ({ min: 0, max: 1 }));
          return regions.map((region) => {
            const { x0, y0, x1, y1 } = clampRegion(shot, region);
            let min = 1;
            let max = 0;
            for (let y = y0; y < y1; y++) {
              for (let x = x0; x < x1; x++) {
                const l = luminanceAt(shot.pixels, (y * shot.width + x) << 2);
                if (l < min) min = l;
                if (l > max) max = l;
              }
            }
            return max < min ? { min: 0, max: 1 } : { min, max };
          });
        })();`,
      )(data, regions) as Promise<{ min: number; max: number }[]>,
    { data, regions, tools: TOOLS },
  );
}

/* What follows asks about the cloud itself, not about what is behind a word:
   whether it painted, where it is, how far it spreads and whether a hole has
   opened in it. The same measure answers all of them, because on a page that is
   one flat wall a pixel of the cloud is a pixel that is not the wall.

   They were once counts of pixels brighter than a threshold, which was a fair
   question over black and is no question at all over a mid grey wall: every
   pixel of the wall is brighter than the threshold, so the count was the area of
   the frame, the engine passed "painted something" with the engine off, and a
   hole in the middle of the cloud changed nothing a test could see. The ground
   is read off the photograph as it is above, so the same measure is right over
   the carbon veil during the opening.

   Take the photograph with the page hidden (photographBehind, or a test's own
   style), or the words and the controls are marks as well. */

/* A mark the eye can see, for the questions about the cloud rather than about
   what is behind a word. MARK_CEILING is the least that counts as a mark at
   all, and it is small on purpose: it is there to prove nothing is behind a
   piece of content. A faint edge of chalk is not what a test asking where the
   cloud is wants to find. The thinnest pigment the site draws with is 0.16 from
   the wall at full strength, and this is about a third of that. */
export const VISIBLE_MARK = 0.05;

export type Disc = { x: number; y: number; radius: number };

/* How many pixels of the photograph are a mark, in the whole frame or inside a
   disc. The disc is in the photograph's own pixels. */
export function countMarks(
  decoder: Page,
  data: string,
  { over = VISIBLE_MARK, within }: { over?: number; within?: Disc } = {},
): Promise<number> {
  return decoder.evaluate(
    ({
      data,
      over,
      within,
      tools,
    }: {
      data: string;
      over: number;
      within: Disc | null;
      tools: string;
    }) =>
      new Function(
        "data",
        "over",
        "within",
        `${tools}
        return (async () => {
          const shot = await decodeShot(data);
          if (!shot) return -1;
          const wall = wallOf(shot.pixels);
          const box = within
            ? clampRegion(shot, {
                x: within.x - within.radius,
                y: within.y - within.radius,
                width: within.radius * 2,
                height: within.radius * 2,
              })
            : { x0: 0, y0: 0, x1: shot.width, y1: shot.height };
          let marked = 0;
          for (let y = box.y0; y < box.y1; y++) {
            for (let x = box.x0; x < box.x1; x++) {
              if (within && (x - within.x) ** 2 + (y - within.y) ** 2 > within.radius ** 2) continue;
              if (distanceFrom(shot.pixels, (y * shot.width + x) << 2, wall) > over) marked += 1;
            }
          }
          return marked;
        })();`,
      )(data, over, within) as Promise<number>,
    { data, over, within: within ?? null, tools: TOOLS },
  );
}

/* The centroid of the marks: where the cloud is, wherever the timeline has put
   it. A number copied out of the timeline, the aspect and the camera into a test
   is a number that goes stale silently. Zero marks reads as the origin with a
   count of nought, so a caller can say it found nothing. */
export function marksCentroid(
  decoder: Page,
  data: string,
  over = VISIBLE_MARK,
): Promise<{ x: number; y: number; count: number }> {
  return decoder.evaluate(
    ({ data, over, tools }: { data: string; over: number; tools: string }) =>
      new Function(
        "data",
        "over",
        `${tools}
        return (async () => {
          const shot = await decodeShot(data);
          if (!shot) return { x: 0, y: 0, count: 0 };
          const wall = wallOf(shot.pixels);
          let sumX = 0;
          let sumY = 0;
          let count = 0;
          for (let y = 0; y < shot.height; y += 2) {
            for (let x = 0; x < shot.width; x += 2) {
              if (distanceFrom(shot.pixels, (y * shot.width + x) << 2, wall) > over) {
                sumX += x;
                sumY += y;
                count += 1;
              }
            }
          }
          return count > 0
            ? { x: Math.round(sumX / count), y: Math.round(sumY / count), count }
            : { x: 0, y: 0, count: 0 };
        })();`,
      )(data, over) as Promise<{ x: number; y: number; count: number }>,
    { data, over, tools: TOOLS },
  );
}

/* The cloud's on-screen radius, as the distance from a point inside which this
   share of the marks sit. Not the furthest mark: the cloud has a faint halo of
   strays, and a maximum takes the radius of the halo. */
export function marksRadius(
  decoder: Page,
  data: string,
  at: { x: number; y: number },
  { over = VISIBLE_MARK, share = 0.9 }: { over?: number; share?: number } = {},
): Promise<number> {
  return decoder.evaluate(
    ({
      data,
      at,
      over,
      share,
      tools,
    }: {
      data: string;
      at: { x: number; y: number };
      over: number;
      share: number;
      tools: string;
    }) =>
      new Function(
        "data",
        "at",
        "over",
        "share",
        `${tools}
        return (async () => {
          const shot = await decodeShot(data);
          if (!shot) return 0;
          const wall = wallOf(shot.pixels);
          const distances = [];
          for (let y = 0; y < shot.height; y += 2) {
            for (let x = 0; x < shot.width; x += 2) {
              if (distanceFrom(shot.pixels, (y * shot.width + x) << 2, wall) > over) {
                distances.push(Math.hypot(x - at.x, y - at.y));
              }
            }
          }
          if (distances.length === 0) return 0;
          distances.sort((a, b) => a - b);
          return Math.round(distances[Math.floor(distances.length * share)] ?? 0);
        })();`,
      )(data, at, over, share) as Promise<number>,
    { data, at, over, share, tools: TOOLS },
  );
}
