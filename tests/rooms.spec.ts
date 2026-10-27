import { expect, test, type Page } from "@playwright/test";
import { bandPlan } from "../src/lib/bands";
import { pageRoom, roomOfProject } from "../src/lib/page-rooms";
import { projects } from "../src/lib/projects";
import { hexToRgb, roomOfShape, rooms, type RoomName } from "../src/lib/rooms";
import { writing } from "../src/lib/writing";

/* The wall following the cloud, and every page being in the room it says it is.

   The page is a sequence of rooms and the cloud goes through all of them: the
   wall is the colour of the room the cloud is in, and the room changes when the
   cloud changes shape. That is a promise about what a reader sees, so it is
   asserted as that: scroll to each band, and the colour painted on the root is
   the colour of the room of the shape that band asks for. Not the attribute the
   script sets, which is only how it is done, but the paint.

   The other half is the pages that are not the home page. Each is one room from
   top to bottom and says which in its own markup, and the stylesheet reads it, so
   it has to be right in the first paint, before a script has run, and the head
   has to say the same colour so that a phone's own chrome meets the page. Both
   are checked, and the first with scripts turned off, which is the only way to
   know the stylesheet is doing it alone. */

const INTRO_KEY = "fl-intro-played";

const painted = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
};

const rootColour = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

const themeColour = (page: Page) =>
  page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute("content"));

/* The middle of the band's first screen, put on the line across the middle of the
   window, which is the line the room watcher listens for. */
async function stand(page: Page, id: string) {
  await page.evaluate((bandId) => {
    const band = document.getElementById(bandId)!;
    const box = band.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + box.top + Math.min(box.height / 2, 320) - innerHeight / 2);
  }, id);
}

test.describe("the home page's rooms", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/?brainQuality=off");
    await expect(page.locator("html")).toHaveAttribute("data-js", "1");
  });

  test("start in midnight, with the head saying so", async ({ page }) => {
    expect(await rootColour(page)).toBe(painted(rooms.midnight.wall));
    expect(await themeColour(page)).toBe(rooms.midnight.wall);
  });

  test("move to the room of each band's shape as it is scrolled to", async ({ page }) => {
    for (const band of bandPlan(projects.length)) {
      const room = rooms[roomOfShape[band.shape]];
      await stand(page, band.id);
      await expect(page.locator("html"), `${band.id} is not in ${room.name}`).toHaveAttribute(
        "data-room",
        room.name,
      );
      /* The wall's change is a transition of 900 milliseconds, so it is asked
         for until it arrives and not read the instant the attribute changes. */
      await expect
        .poll(() => rootColour(page), { message: `${band.id}: the wall is not ${room.name}`, timeout: 4000 })
        .toBe(painted(room.wall));
      expect(await themeColour(page), `${band.id}: the browser's chrome is not ${room.name}`).toBe(room.wall);
    }
  });

  test("close on the colour they opened with", async ({ page }) => {
    await stand(page, "contact");
    await expect(page.locator("html")).toHaveAttribute("data-room", "midnight");
    await expect.poll(() => rootColour(page), { timeout: 4000 }).toBe(painted(rooms.midnight.wall));
  });

  test("do not leave the wall in the last room when the page is left by a link", async ({ page }) => {
    await stand(page, "skills");
    await expect(page.locator("html")).toHaveAttribute("data-room", roomOfShape.drape);

    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Writing" }).click();
    await expect(page).toHaveURL(/\/writing$/);
    await expect(page.locator("html")).toHaveAttribute("data-room", pageRoom.writing);
    await expect
      .poll(() => rootColour(page), { timeout: 4000 })
      .toBe(painted(rooms[pageRoom.writing].wall));
    expect(await themeColour(page)).toBe(rooms[pageRoom.writing].wall);

    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "CV" }).click();
    await expect(page).toHaveURL(/\/cv$/);
    await expect(page.locator("html")).toHaveAttribute("data-room", "midnight");
    await expect.poll(() => rootColour(page), { timeout: 4000 }).toBe(painted(rooms.midnight.wall));
  });
});

test.describe("a reader who asked for less motion", () => {
  test("gets the new room at once and not a dissolve", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/?brainQuality=off");

    await stand(page, "work");
    await expect(page.locator("html")).toHaveAttribute("data-room", roomOfShape.surface);
    /* Read straight away. In motion this would be a colour on the way from
       midnight to lagoon for most of a second. */
    expect(await rootColour(page)).toBe(painted(rooms.lagoon.wall));
    await context.close();
  });
});

/* Every page, and what room it is in: the pages with a room of their own, and the
   essays in the room of the project they are about. */
const pages: { path: string; room: RoomName }[] = [
  { path: "/path", room: pageRoom.path },
  { path: "/writing", room: pageRoom.writing },
  { path: "/reel", room: pageRoom.reel },
  { path: "/cv", room: "midnight" },
  { path: "/privacy", room: "midnight" },
  ...writing.map((piece) => ({
    path: `/writing/${piece.slug}`,
    room: roomOfProject(piece.projectSlug),
  })),
];

test.describe("the other pages' rooms", () => {
  for (const { path, room } of pages) {
    test(`${path} is in ${room}, in the head and in the paint`, async ({ page, request }) => {
      const html = await (await request.get(path)).text();
      expect(html, `${path}: the head does not announce ${room}`).toContain(
        `<meta name="theme-color" content="${rooms[room].wall}"`,
      );
      if (room !== "midnight") {
        expect(html, `${path}: the page does not say it is in ${room}`).toContain(
          `data-page-room="${room}"`,
        );
      }

      await page.goto(path);
      expect(await rootColour(page), `${path}: the wall is not ${room}`).toBe(painted(rooms[room].wall));
      await expect(page.locator("html")).toHaveAttribute("data-room", room);
      expect(await themeColour(page)).toBe(rooms[room].wall);
    });
  }

  test("the essays are in the rooms of the projects they are about", () => {
    const home = new Map(
      bandPlan(projects.length)
        .filter(({ id }) => id === "work" || id.startsWith("work-"))
        .flatMap((band, index) =>
          projects
            .slice(index * 2, index * 2 + 2)
            .map((project) => [project.slug, roomOfShape[band.shape]] as const),
        ),
    );
    for (const piece of writing) {
      expect(roomOfProject(piece.projectSlug), `${piece.slug} is not in its project's room`).toBe(
        home.get(piece.projectSlug),
      );
    }
  });
});

test.describe("with scripts turned off", () => {
  test.use({ javaScriptEnabled: false });

  for (const { path, room } of pages.filter((entry) => entry.room !== "midnight")) {
    test(`${path} is still painted in ${room}, by the stylesheet alone`, async ({ page }) => {
      await page.goto(path);
      expect(await rootColour(page)).toBe(painted(rooms[room].wall));
    });
  }
});
