import { expect, test } from "@playwright/test";

/* The two tables on the home page, at the widths people have.

   Between 1100 and 1205 pixels the work index was wider than the column the
   lane leaves it, and on an iPad mini on its side its last column was cut off
   mid-word, "Reproducib", with the table scrolling sideways inside itself. The
   reconstruction ledger did the same between 915 and 1030, which is a browser
   snapped to half of a 1920 screen, and between 1545 and 1710, which is a 1600
   by 900 laptop, and there it was the verdict that went off the edge.

   Nothing in the suite looked at a width that was not one of the two the
   projects use, and nothing could have seen it from the page: a table scrolls
   inside itself, so the page was never wider than the screen, and a test for
   that passed throughout.

   Below 720 pixels the index scrolls inside itself on purpose, which is a phone,
   and the ledger is a list, so neither is asked about here. From 720 up neither
   has any reason to scroll. The widths are the ones that failed, the ones
   either side of each, and the screens people have. */

const WIDTHS = [
  720, 735, 744, 768, 800, 810, 820, 834, 900, 915, 920, 960, 1000, 1024, 1030, 1060, 1080, 1099,
  1100, 1101, 1133, 1160, 1180, 1194, 1205, 1210, 1240, 1280, 1366, 1440, 1536, 1545, 1550, 1600,
  1680, 1710, 1720, 1920, 2560,
];

test("neither table scrolls sideways from 720 pixels up", async ({ browser, isMobile }) => {
  test.skip(Boolean(isMobile), "the widths are made here, so one project is enough");
  test.setTimeout(120_000);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.addInitScript(() => sessionStorage.setItem("fl-intro-played", "1"));
  await page.goto("/?brainQuality=low");
  /* The real faces, not the stand-ins: the table is as wide as its words are. */
  await page.evaluate(() => document.fonts.ready);

  const cut: string[] = [];
  let measured = 0;
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    /* Two frames, so the media queries and the container queries have answered. */
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );
    const tables = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>(".table-wrap"))
        .filter((wrap) => wrap.offsetWidth > 0)
        .map((wrap) => ({
          name: wrap.getAttribute("aria-label") ?? "a table",
          room: wrap.clientWidth,
          needs: wrap.scrollWidth,
        })),
    );
    for (const table of tables) {
      measured += 1;
      /* A pixel for rounding, and no more: the faults were four to fifty-nine. */
      if (table.needs > table.room + 1) {
        cut.push(`${width}: ${table.name} needs ${table.needs} and has ${table.room}`);
      }
    }
  }

  /* Both tables, at every width: a test that finds neither passes for nothing. */
  expect(measured, "both tables were measured at every width").toBe(2 * WIDTHS.length);
  expect(cut, "a table scrolls sideways at these widths").toEqual([]);

  await context.close();
});
