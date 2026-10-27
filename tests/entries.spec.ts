import { expect, test, type Page } from "@playwright/test";
import { projects } from "../src/lib/projects";

/* The ten entries, and that they are not the same page ten times.

   The work was ten entries in one template, and that is what made it feel like
   one long block however many pictures were in it. Now an entry takes one of
   four compositions by its place in the list, and what is asserted here is what
   a reader gets from that: the four in turn, no two neighbours alike, and every
   one of them carrying everything an entry has to carry, so that changing what
   the eye lands on first never costs an argument its caveat.

   Then the geometry, because two things about it have gone wrong and neither
   was a failure of the page's width. The big figure's swatch was taller than its
   line and ran up into the name above it and down over the caption below, and
   a list of statistics told it had room for four across when it was half of
   the entry's width, and broke a figure across two lines. */

const INTRO_KEY = "fl-intro-played";
const ORDER = ["figure", "clip", "split", "poster"] as const;

async function open(page: Page) {
  await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
  await page.goto("/?brainQuality=off");
  await page.evaluate(() => document.fonts.ready);
}

test.describe("the ten entries", () => {
  test.beforeEach(async ({ page }) => open(page));

  test("take four compositions in turn, and no two neighbours are alike", async ({ page }) => {
    const entries = await page
      .locator("article[data-kind]")
      .evaluateAll((nodes) => nodes.map((node) => ({ id: node.id, kind: (node as HTMLElement).dataset.kind })));

    expect(entries.map(({ id }) => id), "the entries are not in the order of the index").toEqual(
      projects.map(({ slug }) => slug),
    );

    entries.forEach(({ id, kind }, index) => {
      /* A project with no statistic has nothing to set large and takes the
         picture first, so that is the one change the rule allows. */
      const wanted = ORDER[index % ORDER.length]!;
      const lead = projects[index]!.stats[0];
      const expected = wanted === "figure" && !lead ? "clip" : wanted;
      expect(kind, `${id} is not the composition its place gives it`).toBe(expected);
    });

    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]!.kind, `${entries[i]!.id} is the same as the entry before it`).not.toBe(
        entries[i - 1]!.kind,
      );
    }
    expect(new Set(entries.map(({ kind }) => kind)).size, "not every composition is used").toBe(4);
  });

  test("every composition carries what an entry has to", async ({ page }) => {
    for (const project of projects) {
      const entry = page.locator(`article#${project.slug}`);
      await expect(entry.locator("h3"), `${project.slug}: no name`).toHaveText(project.name);

      const text = (await entry.textContent())!.replace(/\s+/g, " ");
      expect(text, `${project.slug}: the headline is missing`).toContain(project.headline);
      expect(text, `${project.slug}: the body is missing`).toContain(project.body);
      expect(text, `${project.slug}: what it does not show is missing`).toContain("What this does not show");
      expect(text, `${project.slug}: the limits are missing`).toContain(project.limits);

      for (const stat of project.stats) {
        expect(text, `${project.slug}: the figure ${stat.value} is missing`).toContain(stat.value);
      }
      for (const link of project.links) {
        await expect(
          entry.locator(`a[href="${link.href}"]`),
          `${project.slug}: no link to ${link.href}`,
        ).toHaveCount(1);
      }
    }
  });

  test("set the big figure without the swatch running over its neighbours", async ({ page }) => {
    const figures = page.locator('article[data-kind="figure"] .figure-xl');
    expect(await figures.count(), "no entry sets its figure large").toBeGreaterThan(1);

    const found = await figures.evaluateAll((nodes) =>
      nodes.map((node) => {
        const article = node.closest("article")!;
        const box = node.getBoundingClientRect();
        const swatch = node.querySelector(".flag")?.getBoundingClientRect();
        const name = article.querySelector("h3")!.getBoundingClientRect();
        const caption = node.nextElementSibling?.getBoundingClientRect();
        return {
          id: article.id,
          box: { top: box.top, bottom: box.bottom },
          swatch: swatch ? { top: swatch.top, bottom: swatch.bottom } : null,
          nameBottom: name.bottom,
          captionTop: caption ? caption.top : null,
        };
      }),
    );

    for (const entry of found) {
      expect(entry.box.top, `${entry.id}: the figure starts inside the name above it`).toBeGreaterThanOrEqual(
        entry.nameBottom - 1,
      );
      if (entry.swatch) {
        expect(entry.swatch.top, `${entry.id}: the swatch rises out of its line`).toBeGreaterThanOrEqual(
          entry.box.top - 1,
        );
        expect(entry.swatch.bottom, `${entry.id}: the swatch falls out of its line`).toBeLessThanOrEqual(
          entry.box.bottom + 1,
        );
      }
      if (entry.captionTop !== null) {
        expect(
          entry.captionTop,
          `${entry.id}: the caption starts under the figure and not inside it`,
        ).toBeGreaterThanOrEqual(entry.box.bottom - 1);
      }
    }
  });

  for (const width of [1280, 1920, 2560]) {
    test(`keep every statistic inside its own column at ${width} pixels`, async ({ page, isMobile }) => {
      test.skip(Boolean(isMobile), "the widths are made here, so one project is enough");
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(
        () =>
          new Promise<void>((done) =>
            requestAnimationFrame(() => requestAnimationFrame(() => done())),
          ),
      );

      const spilling = await page.evaluate(() => {
        const found: string[] = [];
        for (const list of Array.from(document.querySelectorAll<HTMLElement>("article dl"))) {
          const columns = list.getBoundingClientRect();
          for (const cell of Array.from(list.children) as HTMLElement[]) {
            const own = cell.getBoundingClientRect();
            const value = cell.querySelector("dd")!;
            /* The figure is a run of text, and a run that wraps has the width of
               its longest line, so it is its box that is held to the column. */
            const range = document.createRange();
            range.selectNodeContents(value);
            const ink = range.getBoundingClientRect();
            if (ink.right > own.right + 1 || ink.right > columns.right + 1) {
              found.push(`${list.closest("article")!.id}: ${value.textContent} runs ${Math.round(ink.right - own.right)}px out of its column`);
            }
          }
        }
        return found;
      });
      expect(spilling).toEqual([]);
    });
  }
});
