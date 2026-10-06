import type { Page } from "@playwright/test";

/* What "nothing goes over the brain and the brain goes over nothing" means as
   a measurement, shared by every test that asks it.

   Contrast asks whether text stays legible over the cloud. This asks whether
   the cloud is behind anything at all, which is the rule the page is built
   to: the contrast measurement passed on a phone while the brain sat behind
   the controls and the table, because a dim enough cloud behind a word is
   still legible. */

/* Anything a reader sees as part of the page rather than as the backdrop: a run
   of words wherever it sits, a card or a control with a surface of its own, a
   picture, a clip, an icon. */
export type ContentBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
};

/* The brightest the backdrop gets behind the page with the page hidden, with a
   margin. The gradient under its scrim was measured at 0.0069; anything over
   this behind a piece of content is the particle cloud. */
export const OVERLAP_CEILING = 0.012;

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
         collector was picking up the cloud's own canvas and then reporting that
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

/* The window with the page hidden, which is the backdrop and the cloud and
   nothing else, in CSS pixels because the boxes are. The default is device
   pixels, which on the phone project is two and three quarter times as many. */
export async function photographBehind(page: Page): Promise<string> {
  await page.addStyleTag({
    content:
      /* The cloud stays. On the site it is mounted beside the page and this
         never came up; a design direction mounts it inside its own page, so
         hiding the page hid the thing being measured and the photograph came
         back as bare paper. Visibility is inherited and can be turned back on
         under something hidden, which is the one property that can express
         "everything but this". */
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

/* The brightest relative luminance inside each region of a photograph,
   decoded on a page of its own so the page under test is not disturbed. */
export function brightestIn(
  decoder: Page,
  data: string,
  regions: { x: number; y: number; width: number; height: number }[],
): Promise<number[]> {
  return decoder.evaluate(
    async ({
      data,
      regions,
    }: {
      data: string;
      regions: { x: number; y: number; width: number; height: number }[];
    }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return regions.map(() => 1);
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const channel = (value: number) => {
        const v = value / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return regions.map((region) => {
        const x0 = Math.max(0, Math.floor(region.x));
        const y0 = Math.max(0, Math.floor(region.y));
        const x1 = Math.min(canvas.width, Math.ceil(region.x + region.width));
        const y1 = Math.min(canvas.height, Math.ceil(region.y + region.height));
        let max = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * canvas.width + x) << 2;
            const luminance =
              0.2126 * channel(pixels[i]!) +
              0.7152 * channel(pixels[i + 1]!) +
              0.0722 * channel(pixels[i + 2]!);
            if (luminance > max) max = luminance;
          }
        }
        return max;
      });
    },
    { data, regions },
  );
}

/* The same rule on a page that is not dark.

   Over black the cloud is light, and "is anything bright behind this word" is
   the whole question. On paper it is ink: darker than the sheet, or in the case
   of chalk on concrete lighter than the wall, or two colours at once. Not one
   of those is a question about brightness.

   What they have in common is that the sheet is flat, so the measurement is
   distance from the sheet's own colour. Nought is bare paper and anything over
   this ceiling is a mark. The sheet is read off the photograph rather than
   passed in: it is the commonest colour in a frame the cloud covers a fraction
   of, which is one fewer number for a caller to get wrong. */
export const MARK_CEILING = 0.03;

/* Both measurements below run in a page of their own, so this is written as a
   string and evaluated there. The alternative is passing a function, which
   Playwright would serialise per call and which cannot then be shared between
   the two of them. */
const MARK_TOOLS = `
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
  function paperOf(pixels) {
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
  function distanceFrom(pixels, i, paper) {
    return Math.max(
      Math.abs(pixels[i] - paper[0]),
      Math.abs(pixels[i + 1] - paper[1]),
      Math.abs(pixels[i + 2] - paper[2]),
    ) / 255;
  }
`;

/* The furthest any pixel inside each region gets from the sheet. Over bare
   paper this is nought, and over a mark it is not. */
export function markedBehind(
  decoder: Page,
  data: string,
  regions: { x: number; y: number; width: number; height: number }[],
): Promise<number[]> {
  return decoder.evaluate(
    ({ data, regions, tools }: { data: string; regions: ContentBox[]; tools: string }) =>
      new Function(
        "data",
        "regions",
        `${tools}
        return (async () => {
          const shot = await decodeShot(data);
          if (!shot) return regions.map(() => 1);
          const paper = paperOf(shot.pixels);
          return regions.map((region) => {
            const x0 = Math.max(0, Math.floor(region.x));
            const y0 = Math.max(0, Math.floor(region.y));
            const x1 = Math.min(shot.width, Math.ceil(region.x + region.width));
            const y1 = Math.min(shot.height, Math.ceil(region.y + region.height));
            let worst = 0;
            for (let y = y0; y < y1; y++) {
              for (let x = x0; x < x1; x++) {
                const d = distanceFrom(shot.pixels, (y * shot.width + x) << 2, paper);
                if (d > worst) worst = d;
              }
            }
            return worst;
          });
        })();`,
      )(data, regions) as Promise<number[]>,
    { data, regions: regions as ContentBox[], tools: MARK_TOOLS },
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
          const paper = paperOf(shot.pixels);
          let marked = 0;
          for (let i = 0; i < shot.pixels.length; i += 4) {
            if (distanceFrom(shot.pixels, i, paper) > over) marked += 1;
          }
          return marked / (shot.pixels.length / 4);
        })();`,
      )(data, over) as Promise<number>,
    { data, over, tools: MARK_TOOLS },
  );
}

/* How much of a photograph is lit, as a share of its pixels over a relative
   luminance. The gradient under its scrim stays below the ceiling above, so
   anything counted here is the cloud: a test that the cloud goes over nothing
   has to show the cloud is there at all, or a cloud cut away entirely passes. */
export function litShare(decoder: Page, data: string, over = 0.05): Promise<number> {
  return decoder.evaluate(
    async ({ data, over }: { data: string; over: number }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return 0;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const channel = (value: number) => {
        const v = value / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      let lit = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const luminance =
          0.2126 * channel(pixels[i]!) +
          0.7152 * channel(pixels[i + 1]!) +
          0.0722 * channel(pixels[i + 2]!);
        if (luminance > over) lit += 1;
      }
      return lit / (pixels.length / 4);
    },
    { data, over },
  );
}
