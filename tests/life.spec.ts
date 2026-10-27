import { expect, test, type Locator, type Page } from "@playwright/test";
import { portrait } from "../src/lib/site";

/* What makes the page feel inhabited, and that none of it costs the reader
   anything they did not agree to.

   Each of these is a decoration, so each is asserted twice: that it does what it
   is for, and that it stays out of the way. The lantern follows the pointer and
   is never there for a reader without one. The tools shy from the pointer and
   come back. The line along the top says how far down the page is. Blocks
   arrive, and are never transparent while they do. The clock is the time in
   Oxford and is not in the server's HTML, because the server's clock is not the
   reader's. And the portrait is a slot that shows nothing until it has a
   picture, because a stand-in face is the one thing this site argues against.

   The cloud is off throughout (brainQuality=off), so these measure the page and
   not a software renderer's idea of a frame. */

const INTRO_KEY = "fl-intro-played";

async function open(page: Page) {
  await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
  await page.goto("/?brainQuality=off");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveAttribute("data-js", "1");
}

/* Where a thing is once it has stopped arriving. A block of the page sits low
   until it is in view and then settles over most of a second, so a position read
   straight after a scroll is a position on the way somewhere. */
async function arrived(locator: Locator) {
  let last = await locator.boundingBox();
  for (let tries = 0; tries < 40; tries += 1) {
    await locator.page().waitForTimeout(150);
    const now = await locator.boundingBox();
    if (now && last && Math.abs(now.x - last.x) < 0.2 && Math.abs(now.y - last.y) < 0.2) return now;
    last = now;
  }
  return last!;
}

test.describe("the lantern", () => {
  test("follows the pointer, and is not there until there is one", async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), "a finger has no pointer to follow");
    await open(page);

    const light = page.locator(".cursor-light");
    await expect(light).toHaveCount(1);
    await expect(light).not.toHaveAttribute("data-on", "");
    expect(await light.evaluate((node) => getComputedStyle(node).opacity), "lit before there was a pointer").toBe("0");

    /* Moved until it answers, because the listener is attached after hydration
       and the first move may come before it. */
    let step = 0;
    await expect
      .poll(async () => {
        step += 1;
        await page.mouse.move(400 + (step % 2), 300);
        return light.getAttribute("data-on");
      })
      .not.toBeNull();

    await expect
      .poll(() => light.evaluate((node) => Number(getComputedStyle(node).opacity)))
      .toBeGreaterThan(0.9);

    /* It arrives where the pointer is, by a transform and nothing else. */
    await expect
      .poll(async () => {
        await page.mouse.move(900, 600);
        const box = await light.boundingBox();
        return box ? Math.round(Math.hypot(box.x + box.width / 2 - 900, box.y + box.height / 2 - 600)) : 9999;
      }, { timeout: 8_000 })
      .toBeLessThan(40);
  });

  test("is never over a word: it is behind every block on the page", async ({ page }) => {
    await open(page);
    const behind = await page.locator(".cursor-light").evaluate((node) => {
      const style = getComputedStyle(node);
      return { position: style.position, zIndex: Number(style.zIndex), events: style.pointerEvents };
    });
    expect(behind.position).toBe("fixed");
    expect(behind.zIndex, "the lantern is not under the page").toBeLessThan(0);
    expect(behind.events, "the lantern would take a click").toBe("none");
  });

  test("does not move for a reader who asked for less motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await open(page);
    await page.mouse.move(400, 300);
    await page.mouse.move(700, 500);
    await page.waitForTimeout(500);
    await expect(page.locator(".cursor-light")).not.toHaveAttribute("data-on", "");
    await context.close();
  });
});

test.describe("the tools", () => {
  test("shy from the pointer and settle back when it goes", async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), "a finger has no pointer to shy from");
    await open(page);

    const chip = page.locator("[data-chip]").nth(2);
    await chip.scrollIntoViewIfNeeded();
    const rest = await arrived(chip);
    const centre = { x: rest.x + rest.width / 2, y: rest.y + rest.height / 2 };

    /* From the left, close, and moved until it answers. */
    const from = { x: rest.x - 24, y: centre.y };
    let step = 0;
    await expect
      .poll(async () => {
        step += 1;
        await page.mouse.move(from.x + (step % 2), from.y);
        return chip.evaluate((node) => (node as HTMLElement).style.transform);
      }, { timeout: 8_000 })
      .not.toBe("");

    await expect
      .poll(async () => {
        const now = (await chip.boundingBox())!;
        return now.x + now.width / 2 - centre.x;
      }, { timeout: 8_000 })
      .toBeGreaterThan(4);

    /* The pointer leaves the field, and the chip is where it was. */
    await page.mouse.move(5, 5);
    await expect
      .poll(() => chip.evaluate((node) => (node as HTMLElement).style.transform), { timeout: 8_000 })
      .toBe("");
    const home = (await chip.boundingBox())!;
    expect(Math.abs(home.x - rest.x), "the chip did not come back").toBeLessThan(1);
    expect(Math.abs(home.y - rest.y)).toBeLessThan(1);
  });

  test("are pushed from where they are and not from where they were when the page loaded", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "a finger has no pointer to shy from");
    await open(page);

    /* The tools arrive: the block sits a little low until it is in view, so a
       position remembered from when the page loaded is about thirty pixels below
       the one the chip ends up in. With the pointer a little below the chip's
       centre, the chip has to go up, away from it. Pushed from the remembered
       place, the pointer would be above the centre and the chip would go down. */
    const chip = page.locator("[data-chip]").nth(2);
    await chip.scrollIntoViewIfNeeded();
    const rest = await arrived(chip);
    const below = { x: rest.x + rest.width / 2, y: rest.y + rest.height / 2 + 14 };

    let step = 0;
    await expect
      .poll(async () => {
        step += 1;
        await page.mouse.move(below.x + (step % 2), below.y);
        return chip.evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42);
      }, { timeout: 8_000 })
      .toBeLessThan(-1);
  });

  test("do not move for a reader who asked for less motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await open(page);
    await page.locator("#skills").scrollIntoViewIfNeeded();
    const chip = page.locator("[data-chip]").nth(2);
    const rest = (await chip.boundingBox())!;
    await page.mouse.move(rest.x - 20, rest.y + rest.height / 2);
    await page.mouse.move(rest.x - 10, rest.y + rest.height / 2);
    await page.waitForTimeout(500);
    expect(await chip.evaluate((node) => (node as HTMLElement).style.transform)).toBe("");
    await context.close();
  });
});

test.describe("the line along the top", () => {
  test("says how far down the page is", async ({ page }) => {
    await open(page);
    const supported = await page.evaluate(() => CSS.supports("animation-timeline: scroll()"));
    test.skip(!supported, "this browser cannot tie an animation to a scroll, and the line is left out");

    const fraction = () =>
      page.locator(".scroll-progress").evaluate((node) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
        return matrix.a;
      });

    expect(await fraction(), "drawn at the top of the page").toBeLessThan(0.02);

    await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
    await expect.poll(fraction).toBeGreaterThan(0.45);
    expect(await fraction()).toBeLessThan(0.55);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(fraction).toBeGreaterThan(0.98);
  });

  test("is in the room's own colour", async ({ page }) => {
    await open(page);
    const colours = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const line = getComputedStyle(document.querySelector(".scroll-progress")!);
      return { tone: root.getPropertyValue("--tone").trim(), line: line.backgroundColor };
    });
    const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(colours.tone.slice(at, at + 2), 16));
    expect(colours.line).toBe(`rgb(${r}, ${g}, ${b})`);
  });
});

test.describe("the arrivals", () => {
  test("are marked as the page is scrolled, and are never transparent on the way", async ({ page }) => {
    await open(page);

    const waiting = () => page.locator("[data-reveal]:not([data-in])").count();
    const before = await waiting();
    expect(before, "nothing is waiting to arrive, so nothing was asked to").toBeGreaterThan(10);

    /* Waiting is a position and not a colour, so every word is at full contrast
       whether it has arrived or not. */
    const faded = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-in])")]
        .filter((node) => Number(getComputedStyle(node).opacity) < 1)
        .map((node) => node.className || node.tagName),
    );
    expect(faded, "something waiting to arrive is transparent").toEqual([]);

    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 700) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await page.waitForTimeout(40);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(waiting, { timeout: 5_000 }).toBe(0);
  });

  test("are where they would have been for a reader who asked for less motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await open(page);
    const displaced = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-in])")].filter(
        (node) => getComputedStyle(node).transform !== "none",
      ).length,
    );
    expect(displaced, "a block is held low for a reader who asked for less motion").toBe(0);
    await context.close();
  });

  test("leave the page whole when scripts are off", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    const displaced = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter(
        (node) => getComputedStyle(node).transform !== "none",
      ).length,
    );
    expect(displaced, "a block is held low with nothing to bring it up").toBe(0);
    await context.close();
  });
});

test.describe("the clock", () => {
  const london = () =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  const minutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h! * 60 + m!;
  };

  test("is the time in Oxford, and is not in the server's HTML", async ({ page, request }) => {
    const html = await (await request.get("/")).text();
    const served = /data-live-time[^>]*>([^<]*)</.exec(html)?.[1];
    expect(served, "the clock is not in the page at all").toBeDefined();
    expect(served!.trim(), "the server printed a time, which is the server's and not the reader's").toBe("");

    await open(page);
    const clock = page.locator("[data-live-time]");
    await expect(clock).toHaveText(/^\d{2}:\d{2}$/);
    const shown = (await clock.textContent())!;
    const gap = Math.abs(minutes(shown) - minutes(london()));
    expect(Math.min(gap, 1440 - gap), `the clock says ${shown} and it is ${london()} in Oxford`).toBeLessThanOrEqual(1);
  });

  test("is not read out", async ({ page }) => {
    await open(page);
    await expect(page.locator("[data-live-time]")).toHaveAttribute("aria-hidden", "true");
  });

  test("does not move the page when it arrives", async ({ page }) => {
    await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/?brainQuality=off", { waitUntil: "commit" });
    const label = page.locator("#hero .t-label").first();
    await label.waitFor();
    const before = await label.boundingBox();
    await expect(page.locator("[data-live-time]")).toHaveText(/^\d{2}:\d{2}$/);
    const after = await label.boundingBox();
    expect(after!.width, "the label changed width when the time arrived").toBeCloseTo(before!.width, 0);
    expect(after!.height).toBeCloseTo(before!.height, 0);
  });
});

test.describe("the index", () => {
  test("lights the row under the pointer", async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), "a finger has no pointer to light a row");
    await open(page);

    const row = page.locator(".index-work tbody tr").nth(2);
    await row.scrollIntoViewIfNeeded();
    const background = () => row.evaluate((node) => getComputedStyle(node).backgroundColor);
    const at = (await row.boundingBox())!;
    await page.mouse.move(5, 5);
    const resting = await background();
    await page.mouse.move(at.x + 80, at.y + at.height / 2);
    await expect.poll(background).not.toBe(resting);
  });
});

test.describe("the portrait", () => {
  /* A slot, and nothing in it until there is a picture. Two states, and both are
     the honest one: with no picture the about section has no image at all, and
     with one it has a description for somebody who cannot see it. */
  test("shows no face that is not his", async ({ page }) => {
    await open(page);
    const images = page.locator("#about img");
    if (portrait === null) {
      await expect(images, "the about section has an image and there is no portrait to put in it").toHaveCount(0);
    } else {
      await expect(images).toHaveCount(1);
      expect(await images.first().getAttribute("alt"), "the portrait has no description").toBeTruthy();
    }
  });
});
