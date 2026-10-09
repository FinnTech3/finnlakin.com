import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { bays } from "../src/lib/bays";

/* The Bays against the disk, and the heading against the list.

   A bay is filled by adding a piece to src/lib/bays.ts. Everything that can go
   wrong with that is checkable without a browser: the file is not where it says,
   it has no description for somebody who cannot see it, or its size is missing
   and the page moves when it loads. The one thing that needs the page is the
   heading, which counts the filled bays from the list, and which must say none
   today because none is. */

const PUBLIC = join(__dirname, "..", "public");

test.describe("the bays", () => {
  test("every piece is a file that exists, with a description and a size", () => {
    for (const bay of bays) {
      if (!bay.piece) continue;
      const file = join(PUBLIC, bay.piece.src);
      expect(existsSync(file), `${bay.label} names ${bay.piece.src}, which is not there`).toBe(true);
      expect(statSync(file).size, `${bay.label} names ${bay.piece.src}, which is empty`).toBeGreaterThan(0);
      expect(bay.piece.alt.trim().length, `${bay.label} has no description`).toBeGreaterThan(8);
      expect(bay.piece.width, `${bay.label} has no width`).toBeGreaterThan(0);
      expect(bay.piece.height, `${bay.label} has no height`).toBeGreaterThan(0);
    }
  });

  test("the heading counts the filled bays from the list", async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), "the same markup on both projects");
    await page.goto("/");
    const filled = bays.filter((bay) => bay.piece).length;
    const heading = page.getByRole("heading", { name: "Bays", exact: true }).locator("xpath=..");
    const text = (await heading.textContent()) ?? "";
    if (filled === 0) expect(text).toContain("none filled");
    else expect(text).not.toContain("none filled");
    expect(await page.locator(".bay").count(), "one empty bay per unfilled entry").toBe(bays.length - filled);
  });
});
