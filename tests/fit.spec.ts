import { expect, test, type Page } from "@playwright/test";
import { marksExtent } from "./cloud-overlap";

/* The cloud on the screens people actually have.

   Finn loaded the site on an iPad and the brain was the wrong size. Measured,
   every iPad held on its side, which has the lane beside the content that a
   laptop has, drew the cloud a sixth of the height of the screen where a laptop
   draws it over a third: the engine took a coarse pointer to mean a phone, so a
   tablet was drawn at a phone's size. Nothing in the suite looked at a screen
   that was not the two the projects use, so nothing could have noticed.

   Each screen here is made in the test and not taken from a project, so the
   same two projects ask about all of them. The page is hidden for the
   photograph so the only marks in it are the cloud's, the box the marks occupy
   is measured, and it is read against the room the layout gave the cloud: the
   lane where there is one, the slot under the hero's controls where there is
   not. A reader who asked for less motion gets one settled frame, which makes
   the measurement a property of the composition and not of how many frames a
   machine without a graphics card managed to draw.

   Nothing here can be a real iPad. These are Chromium windows of an iPad's
   size and pixel ratio with a touch screen, which is the whole of what the page
   reads about a device, and not Safari, which is not available here. */

type Screen = {
  name: string;
  width: number;
  height: number;
  scale: number;
  touch: boolean;
  /* Whether the engine should call this a small screen, which is a phone and
     never a tablet. */
  compact: boolean;
};

const SCREENS: Screen[] = [
  { name: "an iPad mini upright", width: 744, height: 1133, scale: 2, touch: true, compact: false },
  { name: "an iPad mini on its side", width: 1133, height: 744, scale: 2, touch: true, compact: false },
  { name: "an iPad Air upright", width: 820, height: 1180, scale: 2, touch: true, compact: false },
  { name: "an iPad Air on its side", width: 1180, height: 820, scale: 2, touch: true, compact: false },
  { name: "an iPad Pro 12.9 upright", width: 1024, height: 1366, scale: 2, touch: true, compact: false },
  { name: "an iPad Pro 12.9 on its side", width: 1366, height: 1024, scale: 2, touch: true, compact: false },
  { name: "an older iPad on its side", width: 1024, height: 768, scale: 2, touch: true, compact: false },
  { name: "a laptop", width: 1280, height: 720, scale: 1, touch: false, compact: false },
  { name: "an ultrawide monitor", width: 2560, height: 1080, scale: 1, touch: false, compact: false },
  { name: "a desktop window dragged tall", width: 1100, height: 1300, scale: 1, touch: false, compact: false },
  { name: "a phone on its side", width: 844, height: 390, scale: 3, touch: true, compact: true },
];

/* The breakpoint, which is also in globals.css and in the engine. */
const LANE_FROM = 1100;
const LANE_SHARE = 0.4;

type Reading = {
  wide: boolean;
  compact: boolean;
  touch: boolean;
  instances: number;
  overflow: number;
  slot: { top: number; height: number } | null;
  hostHeight: number;
};

async function read(page: Page): Promise<Reading> {
  return page.evaluate(() => {
    const brain = (
      window as unknown as {
        particleBrain: {
          inspect: () => {
            layout: { wide: boolean };
            device: { compact: boolean; touch: boolean };
            instances: number;
          };
        };
      }
    ).particleBrain.inspect();
    const slot = document.querySelector("[data-brain-slot]")?.getBoundingClientRect();
    const host = document.querySelector("[data-brain]")?.getBoundingClientRect();
    return {
      wide: brain.layout.wide,
      compact: brain.device.compact,
      touch: brain.device.touch,
      instances: brain.instances,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      slot: slot && slot.height > 0 ? { top: slot.top + window.scrollY, height: slot.height } : null,
      hostHeight: host ? host.height : 0,
    };
  });
}

/* The wall and the cloud and nothing else, over the canvas's whole area: the
   window where the canvas is fixed to it, and the first screen's worth of the
   page below the breakpoint, where it is not and the slot can run on past the
   fold. */
async function photograph(page: Page, area: { width: number; height: number } | null) {
  await page.addStyleTag({
    content:
      "body > header, body > main, body > footer { visibility: hidden !important }" +
      " [data-brain] { visibility: visible !important }",
  });
  const shot = (
    await page.screenshot({
      scale: "css",
      fullPage: area !== null,
      clip: area ? { x: 0, y: 0, width: area.width, height: area.height } : undefined,
    })
  ).toString("base64");
  await page.evaluate(() => {
    const sheets = Array.from(document.head.querySelectorAll("style"));
    const last = sheets[sheets.length - 1];
    if (last && last.textContent?.includes("visibility: hidden")) last.remove();
  });
  return shot;
}

test.describe("the cloud on the screens people have", () => {
  /* One screen takes the page loading, the engine building thirty odd thousand
     particles and a photograph decoded, all on a machine with no graphics
     card. */
  test.describe.configure({ timeout: 120_000 });

  for (const screen of SCREENS) {
    test(`is sized to ${screen.name}, ${screen.width} by ${screen.height}`, async ({
      browser,
      isMobile,
    }) => {
      test.skip(Boolean(isMobile), "the screens are made here, so one project is enough");

      const context = await browser.newContext({
        viewport: { width: screen.width, height: screen.height },
        deviceScaleFactor: screen.scale,
        hasTouch: screen.touch,
        isMobile: screen.touch,
        reducedMotion: "reduce",
      });
      const decoder = await context.newPage();
      const page = await context.newPage();
      await page.addInitScript(() => sessionStorage.setItem("fl-intro-played", "1"));
      await page.goto("/?brainQuality=medium&brainDebug=1");
      await page.evaluate(() => document.fonts.ready);
      await expect
        .poll(() => page.locator("[data-brain]").getAttribute("data-brain"), { timeout: 60_000 })
        .toBe("still");
      /* The settled frame, drawn. */
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                (
                  window as unknown as {
                    particleBrain?: { inspect: () => { frameMs: number } };
                  }
                ).particleBrain?.inspect().frameMs ?? 0,
            ),
          { timeout: 60_000 },
        )
        .toBeGreaterThan(0);
      await page.waitForTimeout(500);

      const reading = await read(page);

      /* What the engine took the screen to be. A tablet is a screen as large as
         a laptop's and gets a laptop's cloud, with a touch screen's pointer. */
      expect(reading.compact, "a tablet was taken for a phone").toBe(screen.compact);
      expect(reading.touch, "the touch screen was not noticed").toBe(screen.touch);
      expect(reading.wide, "the layout and the engine disagree about the lane").toBe(
        screen.width >= LANE_FROM,
      );
      expect(
        reading.instances,
        screen.compact ? "a phone draws the smaller cloud" : "a tablet draws the full size cloud",
      ).toBe(screen.compact ? 7000 : 14000);

      /* Nothing wider than the screen. */
      expect(reading.overflow, "the page is wider than the screen").toBeLessThanOrEqual(0);

      const shot = await photograph(
        page,
        reading.wide ? null : { width: screen.width, height: Math.ceil(reading.hostHeight) },
      );
      const box = await marksExtent(decoder, shot);
      expect(box.count, "nothing was drawn").toBeGreaterThan(0);
      const across = box.right - box.left;
      const down = box.bottom - box.top;

      if (reading.wide) {
        /* In the lane, and the size of what the lane leaves room for.

           Two limits and the cloud is the smaller of them: a share of the
           window's height, which is the same on every window that is wide
           enough for it, and a share of the lane's width, which is what a
           window that is not wide enough has. A laptop is height limited and a
           tablet held on its side is nearly there; a browser dragged tall is
           width limited and is smaller, because the lane is a narrow strip, and
           that is right. What is asserted is that it fills one of the two and
           is clipped by neither: not cut at the lane's edge, which is where the
           final pass keeps it, and not at the screen's. */
        const lane = LANE_SHARE * screen.width;
        const tall = down / screen.height;
        const share = across / lane;
        expect(
          Math.max(tall / 0.3, share / 0.7),
          `the cloud is ${Math.round(down)} pixels tall in a window ${screen.height} tall and ` +
            `${Math.round(across)} wide in a lane ${Math.round(lane)} wide: it fills neither`,
        ).toBeGreaterThanOrEqual(1);
        expect(tall, "the cloud is far too large").toBeLessThan(0.55);
        expect(
          share,
          `the cloud is ${Math.round(across)} pixels wide in a lane ${Math.round(lane)} wide`,
        ).toBeLessThan(0.98);
        expect(
          box.left,
          "the cloud is cut by the inner edge of its lane",
        ).toBeGreaterThanOrEqual((1 - LANE_SHARE) * screen.width + 0.005 * screen.width);
        expect(box.right, "the cloud is cut by the edge of the screen").toBeLessThanOrEqual(
          0.995 * screen.width,
        );
      } else {
        /* In the slot under the controls, filling most of it and not running
           out of it, and not a speck on a screen with a great deal of room. */
        const slot = reading.slot;
        expect(slot, "there is no slot to draw the cloud in").not.toBeNull();
        expect(
          down / slot!.height,
          `the cloud is ${Math.round(down)} pixels tall in a slot ${Math.round(slot!.height)} tall`,
        ).toBeGreaterThan(0.65);
        expect(box.top, "the cloud starts above its slot").toBeGreaterThanOrEqual(
          slot!.top - 0.1 * slot!.height,
        );
        expect(box.bottom, "the cloud runs past its slot").toBeLessThanOrEqual(
          slot!.top + 1.1 * slot!.height,
        );
        if (!screen.compact) {
          expect(
            across / screen.width,
            `the cloud is ${Math.round(across)} pixels across a screen ${screen.width} wide`,
          ).toBeGreaterThan(0.28);
        }
      }

      await context.close();
    });
  }
});
