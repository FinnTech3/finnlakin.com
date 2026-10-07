import { expect, test, type Page } from "@playwright/test";
import { bandPlan } from "../src/lib/bands";
import { projects } from "../src/lib/projects";
import {
  collectContent,
  MARK_CEILING,
  markedBehind,
  markedShare,
  photographBehind,
} from "./cloud-overlap";

/* Changing columns, measured where it happens.

   The cloud travels down one side of the page and changes sides wherever a band
   that keeps its lane on the right meets one that keeps it on the left, which
   on this page is six times: after every two projects of the work, and again
   either side of the path and the tools. There is no route across the page that
   is not through somebody's paragraph except the seam between the two bands, the
   strip of padding with no text in it, and the rule is that the cloud goes over
   nothing on the way.

   The contrast walk stands at eight fixed points down the document and none of
   them is at a crossing, so a crossing that put the cloud's glow over the last
   line of one band and the heading of the next would pass it. This stands at
   the crossings: at six heights of the seam on the screen, from well below the
   cloud's own height, through it, to well above, so the approach, the crossing
   itself and the arrival are each photographed. Only where the page has lanes,
   which is above the breakpoint. */

const INTRO_KEY = "fl-intro-played";

/* Where the seam is on the screen, as a share of the window's height up from
   the bottom. The cloud rests a little under the middle, at about 0.39. */
const SEAM_HEIGHTS = [0.12, 0.25, 0.35, 0.45, 0.55, 0.7];
const CLOUD_HEIGHT = 0.39;

/* The margin the strip keeps from the nearest line of text at rest, in CSS
   pixels: SEAM_MARGIN_PX in scroll.ts, restated as the thing asserted. */
const SEAM_MARGIN = 16;

type Brain = {
  inspect: () => { frameMs: number; timeline: { mask: { gapHalf: number } } };
};

async function open(page: Page) {
  await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
  await page.goto("/?brainQuality=low&brainDebug=1");
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { particleBrain?: Brain }).particleBrain?.inspect().frameMs,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
}

/* Each place the page changes columns: the band below it, where it starts in
   the document, and the seam's clear half at rest as the page's own padding has
   it, which is the band with no text in it less the margin. Read off the bands
   the page has, in the order it has them, and not off a list of names, so a band
   added to the plan is a band measured here. */
function findCrossings(page: Page) {
  return page.evaluate((margin) => {
    const bands = Array.from(document.querySelectorAll<HTMLElement>("[data-band]"));
    const side = (band: HTMLElement) => (band.classList.contains("band-lane-left") ? -1 : 1);
    const pad = (band: HTMLElement, edge: "paddingTop" | "paddingBottom") => {
      const inner = band.firstElementChild as HTMLElement | null;
      return inner ? Number.parseFloat(getComputedStyle(inner)[edge]) || 0 : 0;
    };
    const found: { name: string; top: number; clear: number }[] = [];
    for (let i = 1; i < bands.length; i++) {
      const above = bands[i - 1]!;
      const below = bands[i]!;
      if (side(above) === side(below)) continue;
      found.push({
        name: `${above.id} to ${below.id}`,
        top: below.getBoundingClientRect().top + window.scrollY,
        clear: (pad(above, "paddingBottom") + pad(below, "paddingTop")) / 2 - margin,
      });
    }
    return found;
  }, SEAM_MARGIN);
}

/* The places the plan says the page changes columns, which is what the page
   is checked against: a band that stopped alternating would otherwise take its
   crossing with it and leave this test measuring one fewer. */
function plannedCrossings(): string[] {
  const plan = bandPlan(projects.length);
  return plan
    .map((band, index) => (index > 0 && band.lane !== plan[index - 1]!.lane ? `${plan[index - 1]!.id} to ${band.id}` : null))
    .filter((name): name is string => name !== null);
}

/* Puts a boundary at a height on the screen, as a share of the window up from
   the bottom. Instant, so the page is exactly where it was asked to be. */
function placeSeam(page: Page, top: number, at: number) {
  return page.evaluate(
    ({ top, at }) =>
      window.scrollTo({
        top: Math.round(top - (1 - at) * window.innerHeight),
        behavior: "instant",
      }),
    { top, at },
  );
}

function gapHalf(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { particleBrain: Brain }).particleBrain.inspect().timeline.mask
        .gapHalf,
  );
}

test.describe("crossing a column", () => {
  /* Thirty six photographs of a page with a thirty two thousand particle cloud
     on it, on a machine with no GPU. */
  test.describe.configure({ timeout: 600_000 });

  test.skip(({ isMobile }) => Boolean(isMobile), "the page only has lanes above the breakpoint");

  test("goes over nothing", async ({ page, browser }) => {
    await open(page);
    const crossings = await findCrossings(page);
    expect(
      crossings.map((crossing) => crossing.name),
      "the page no longer changes columns where its plan says it does",
    ).toEqual(plannedCrossings());

    const decoder = await browser.newPage();
    let measured = 0;
    for (const crossing of crossings) {
      for (const at of SEAM_HEIGHTS) {
        await placeSeam(page, crossing.top, at);
        /* Long enough for the eased timeline to arrive: the transient between
           two states is exactly what a crossing is made of, and what has to be
           measured is where it settles at each height. */
        await page.waitForTimeout(2_500);

        const content = await collectContent(page);
        measured += content.length;
        const shot = await photographBehind(page);
        /* The cloud is on screen at every height, contracted in the seam or
           open in a column: a crossing that cut it away entirely would go
           over nothing too. */
        expect(
          await markedShare(decoder, shot),
          `crossing ${crossing.name} with the seam at ${at} of the window, the cloud is not on screen`,
        ).toBeGreaterThan(0.001);
        const behind = await markedBehind(decoder, shot, content);
        content.forEach((box, index) => {
          expect(
            behind[index] ?? 1,
            `crossing ${crossing.name} with the seam at ${at} of the window, ` +
              `"${box.label}" has the cloud behind it`,
          ).toBeLessThanOrEqual(MARK_CEILING);
        });
      }
    }
    await decoder.close();
    expect(measured, "nothing on the page was measured, so this proves nothing").toBeGreaterThan(
      20,
    );
  });

  /* The mask is worked out from where the page was when the frame began, and a
     compositor that scrolls on its own thread can show the page a frame further
     on. So while the page moves, the seam's clear half is narrowed by how far
     it moved in the last frame, and a mask a frame behind a fling still cannot
     reach a line of text. A page at rest has moved nowhere, and at rest the
     cloud has the whole of the seam back.

     Both motion settings, because reduced motion takes its own road through a
     frame and got both halves wrong. It measured the page twice in one frame,
     and the second measurement found it had not moved, so a fling kept no
     margin at all. And it draws only when the page moves, so the picture a
     reader was left looking at kept the margin of the last scroll, or after a
     jump to a section none of the seam at all. */
  for (const motion of ["no-preference", "reduce"] as const) {
    test(`keeps a frame's scroll of margin in the seam while the page moves, and only then (${motion})`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await open(page);
      const [crossing] = await findCrossings(page);
      expect(crossing, "the page no longer changes columns").toBeDefined();
      const height = await page.evaluate(() => window.innerHeight);
      const atRest = crossing!.clear / height;
      expect(atRest, "the seam has no clear band to cross in").toBeGreaterThan(0);

      /* Arrived by a jump, the way a link to a section arrives. */
      await placeSeam(page, crossing!.top, CLOUD_HEIGHT);
      await page.waitForTimeout(2_500);
      expect(await gapHalf(page), "at rest after a jump, the seam is not all the cloud's").toBeCloseTo(
        atRest,
        4,
      );

      /* A fling, forty pixels a frame back and forth across the same place so
         the seam stays at the cloud's height. Read once every callback in the
         frame has run: a still frame is asked for from the scroll handler, so
         it runs after anything asked for before the page moved. */
      const step = 40;
      const moving = await page.evaluate(
        async ({ step, frames }) => {
          const brain = (window as unknown as { particleBrain: Brain }).particleBrain;
          const base = window.scrollY;
          const drawn = () =>
            new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
          const seen: number[] = [];
          for (let i = 0; i < frames; i++) {
            window.scrollTo({ top: base + (i % 2 === 0 ? step : 0), behavior: "instant" });
            await drawn();
            seen.push(brain.inspect().timeline.mask.gapHalf);
          }
          return seen;
        },
        { step, frames: 8 },
      );
      for (const [frame, value] of moving.entries()) {
        expect(
          value,
          `${step}px into a fling, frame ${frame}, the seam keeps no margin for it`,
        ).toBeCloseTo((crossing!.clear - step) / height, 4);
      }

      /* And once it stops. */
      await page.waitForTimeout(2_500);
      expect(await gapHalf(page), "at rest after a fling, the seam is not all the cloud's").toBeCloseTo(
        atRest,
        4,
      );
    });
  }
});
