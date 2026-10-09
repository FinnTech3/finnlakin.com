import { expect, test } from "@playwright/test";

/* Every route at the widths people have.

   Two tables were cut off at widths nobody had tested, and the check that
   caught neither was the one that every route already passed: the page is no
   wider than the screen. A table that scrolls inside itself does not widen the
   page. So this asks the questions that the page-width check cannot, at a spread
   of widths from a small tablet to an ultrawide window, on every route:

   nothing is cut by the screen's edge, nothing scrolls sideways inside itself
   (there is no reason for anything to, from 720 pixels up), and on the home
   page, the one with lanes, nothing a reader can see is inside the lane the
   cloud is drawn in.

   tests/tables.spec.ts holds the two tables to the same thing at many more
   widths, because that is where it was found. */

const ROUTES = [
  "/",
  "/path",
  "/reel",
  "/writing",
  "/writing/marked-to-model",
  "/writing/whose-inflation",
  "/writing/term-premium",
  "/writing/nanobook",
  "/cv",
  "/privacy",
  "/nothing-here",
];

const WIDTHS = [720, 768, 820, 1024, 1099, 1100, 1133, 1180, 1280, 1440, 1600, 1920, 2560];
const LANE_FROM = 1100;
const LANE_SHARE = 0.4;

type Finding = { kind: string; what: string };

/* Runs in the page. Visible means it has a size, is not hidden and is not
   transparent; a scroller is anything that clips sideways, and what is seen of an
   element is its box cut down by every scroller around it. */
function probe(lane: { from: number; share: number }): Finding[] {
  const found: Finding[] = [];
  const width = window.innerWidth;
  const name = (el: Element) =>
    `${el.tagName.toLowerCase()}${
      typeof (el as HTMLElement).className === "string" && (el as HTMLElement).className
        ? "." + (el as HTMLElement).className.trim().split(/\s+/).slice(0, 2).join(".")
        : ""
    } "${(el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30)}"`;
  const shown = (el: Element) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return (
      rect.width > 1 &&
      rect.height > 1 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      Number(style.opacity) !== 0
    );
  };
  const clippers = (el: Element) => {
    const list: Element[] = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) list.push(p);
    }
    return list;
  };
  const seen = (el: Element): [number, number] => {
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    let right = rect.right;
    for (const p of clippers(el)) {
      const box = p.getBoundingClientRect();
      left = Math.max(left, box.left);
      right = Math.min(right, box.right);
    }
    return [left, right];
  };

  if (document.documentElement.scrollWidth > width + 1) {
    found.push({ kind: "page wider than the screen", what: String(document.documentElement.scrollWidth) });
  }
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (!shown(el)) continue;
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1) {
      found.push({ kind: "scrolls sideways inside itself", what: name(el) });
    }
    const [left, right] = seen(el);
    if ((left < -1 && right > 1) || (right > width + 1 && left < width - 1)) {
      found.push({ kind: "cut by the screen's edge", what: `${name(el)} ${Math.round(left)} to ${Math.round(right)}` });
    }
  }
  if (width >= lane.from) {
    for (const band of Array.from(document.querySelectorAll("[data-band]"))) {
      const left = band.classList.contains("band-lane-left");
      const lo = left ? 0 : width * (1 - lane.share);
      const hi = left ? width * lane.share : width;
      for (const el of Array.from(band.querySelectorAll("*"))) {
        if (!shown(el)) continue;
        const owns =
          Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0) ||
          ["IMG", "VIDEO"].includes(el.tagName);
        if (!owns) continue;
        const [l, r] = seen(el);
        const into = Math.min(r, hi) - Math.max(l, lo);
        if (into > 2) {
          found.push({ kind: "visible inside the cloud's lane", what: `${band.id} ${Math.round(into)}px: ${name(el)}` });
        }
      }
    }
  }
  return found;
}

test.describe("every route at the widths people have", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const route of ROUTES) {
    test(`${route} has nothing cut off, scrolling sideways or in the lane`, async ({
      browser,
      isMobile,
    }) => {
      test.skip(Boolean(isMobile), "the widths are made here, so one project is enough");
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.addInitScript(() => sessionStorage.setItem("fl-intro-played", "1"));
      await page.goto(`${route}?brainQuality=low`);
      /* The real faces: a column is as wide as its words are. */
      await page.evaluate(() => document.fonts.ready);

      const problems: string[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(
          () =>
            new Promise<void>((done) =>
              requestAnimationFrame(() => requestAnimationFrame(() => done())),
            ),
        );
        const found = await page.evaluate(probe, { from: LANE_FROM, share: LANE_SHARE });
        for (const item of found.slice(0, 3)) problems.push(`${width}: ${item.kind}: ${item.what}`);
      }
      expect(problems, `${route} at the widths people have`).toEqual([]);
      await context.close();
    });
  }
});
