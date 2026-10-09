import { expect, test, type Page } from "@playwright/test";
import { bandPlan, PROJECTS_PER_BAND } from "../src/lib/bands";
import { projects } from "../src/lib/projects";
import { chainOf, SHAPE_NAMES, shapeSlot } from "../src/particles/structures";

/* The ten projects in pairs, and the cloud following them from side to side.

   Finn asked for the projects not to sit on one side of the screen all the way
   down, and to change sides after every two, so that the brain has to cross the
   page and the cloud spends its time changing between the brain and the other
   structures and not being the brain from the first project to the last.

   What he asked for is a property of the page and a property of the engine, and
   both are asserted here as what a reader gets. The markup: five bands of two
   projects, in the order of the index, alternating from the right-hand lane to
   the left and back, each asking for a shape the engine has. The engine: stood
   in the middle of each band, the cloud is on the side the band says and is the
   shape the band says, read back off the page by the engine and not told. The
   plan the page is built from is in src/lib/bands.ts and is read here from the
   same place, so a band added to it is a band checked. */

const INTRO_KEY = "fl-intro-played";

type Reading = { id: string; lane: string; shape: string; articles: string[] };

function readBands(page: Page): Promise<Reading[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-band]")).map((band) => ({
      id: band.id,
      lane: band.classList.contains("band-lane-left") ? "left" : "right",
      shape: band.dataset.shape ?? "",
      articles: Array.from(band.querySelectorAll("article")).map((article) => article.id),
    })),
  );
}

test.describe("the page's bands", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/?brainQuality=off");
  });

  test("are the plan, in its order, with the side and shape it gives each", async ({ page }) => {
    const plan = bandPlan(projects.length);
    const bands = await readBands(page);
    expect(
      bands.map(({ id, lane, shape }) => ({ id, lane, shape })),
      "the markup and the plan disagree about the bands",
    ).toEqual(plan.map(({ id, lane, shape }) => ({ id, lane, shape })));
  });

  test("hold the ten projects as five pairs, in the order of the index", async ({ page }) => {
    const bands = (await readBands(page)).filter(({ id }) => id === "work" || id.startsWith("work-"));
    expect(bands.length, "ten projects are five bands of two").toBe(
      Math.ceil(projects.length / PROJECTS_PER_BAND),
    );
    expect(bands.length).toBe(5);

    for (const band of bands) {
      expect(band.articles.length, `the band ${band.id} does not hold a pair`).toBe(PROJECTS_PER_BAND);
    }
    expect(
      bands.flatMap(({ articles }) => articles),
      "the projects are not in the order of the index",
    ).toEqual(projects.map(({ slug }) => slug));
  });

  test("change sides after every pair of projects", async ({ page }) => {
    const bands = (await readBands(page)).filter(({ id }) => id === "work" || id.startsWith("work-"));
    expect(bands[0]!.lane, "the work opens on the same side as the hero").toBe("right");
    for (let i = 1; i < bands.length; i++) {
      expect(
        bands[i]!.lane,
        `${bands[i]!.id} is on the same side as ${bands[i - 1]!.id}`,
      ).not.toBe(bands[i - 1]!.lane);
    }
  });

  test("ask for shapes the engine has, and the work does not repeat one", async ({ page }) => {
    const bands = await readBands(page);
    for (const band of bands) {
      expect(SHAPE_NAMES as readonly string[], `${band.id} asks for a shape that is not there`).toContain(
        band.shape,
      );
    }
    const work = bands.filter(({ id }) => id === "work" || id.startsWith("work-"));
    expect(new Set(work.map(({ shape }) => shape)).size, "two bands of the work are the same shape").toBe(
      work.length,
    );

    /* The cloud changes between the brain and the others as it goes, and does not
       stay the brain from the first project to the last: it changes shape at
       least eight times, opens and closes on the brain, and comes back to it
       in between. */
    const { chain } = chainOf(bands.map(({ shape }) => shapeSlot(shape)));
    expect(chain.length - 1, "the cloud changes shape fewer than eight times").toBeGreaterThanOrEqual(8);
    expect(chain[0], "the page opens on the brain").toBe(0);
    expect(chain.at(-1), "the page closes on the brain").toBe(0);
    expect(chain.slice(1, -1).filter((slot) => slot === 0).length, "the brain comes back between").toBeGreaterThan(0);
  });
});

/* The engine reading the same page. Only where there is a lane: below the
   breakpoint the cloud lives under the hero's controls and there is no side to
   be on. */
test.describe("the cloud beside each band", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "the page only has lanes above the breakpoint");
  test.describe.configure({ timeout: 300_000 });

  type Brain = {
    inspect: () => { frameMs: number; timeline: { progress: number; mask: { side: number } } };
  };

  const inspect = (page: Page) =>
    page.evaluate(() => (window as unknown as { particleBrain?: Brain }).particleBrain?.inspect());

  test("is on the band's side and is the band's shape, read back off the page", async ({ page }) => {
    await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/?brainQuality=low&brainDebug=1");
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(async () => (await inspect(page))?.frameMs ?? 0, { timeout: 60_000 })
      .toBeGreaterThan(0);

    const plan = bandPlan(projects.length);
    const { index } = chainOf(plan.map((band) => shapeSlot(band.shape)));
    const { height, reach } = await page.evaluate(() => ({
      height: window.innerHeight,
      reach: document.documentElement.scrollHeight - window.innerHeight,
    }));
    /* Where the cloud rests on the screen, as a share of the window's height up
       from the bottom: a little under the middle. */
    const CLOUD_HEIGHT = 0.39;

    const places = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-band]")).map((band) => {
        const box = band.getBoundingClientRect();
        return { id: band.id, top: box.top + window.scrollY, height: box.height };
      }),
    );

    let stood = 0;
    for (const [at, place] of places.entries()) {
      /* Stood in the middle of a band that is tall enough to have a middle: one
         whose neighbours' seams are not within the cloud's crossing window of
         it. The hero is the opening, which has a composition of its own, and
         the contact band is shorter than the window and cannot be scrolled to
         its middle. */
      if (place.id === "hero" || place.height < height * 0.75) continue;
      const middle = place.top + place.height / 2;
      const scrollTo = Math.round(middle - (1 - CLOUD_HEIGHT) * height);
      if (scrollTo < 0 || scrollTo > reach) continue;
      await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), scrollTo);

      const lane = plan[at]!.lane === "right" ? 1 : -1;
      await expect
        .poll(async () => (await inspect(page))?.timeline.mask.side, {
          message: `beside ${place.id} the cloud is not on the ${plan[at]!.lane}`,
          timeout: 30_000,
        })
        .toBe(lane);
      await expect
        .poll(async () => (await inspect(page))?.timeline.progress ?? -1, {
          message: `beside ${place.id} the cloud is not the shape that band asks for`,
          timeout: 30_000,
        })
        .toBeCloseTo(index[at]!, 1);
      stood += 1;
    }
    expect(stood, "too few bands were stood in for this to prove anything").toBeGreaterThanOrEqual(6);
  });
});
