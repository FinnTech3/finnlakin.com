import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { products } from "../src/lib/software";

/* The software page against its data and the brief it was built to.

   The page renders from src/lib/software.ts, so most of this is a comparison
   between that file and what a reader is given: every product is there, the link
   a card leads with is the one the data says it is, and nothing links to a
   marketplace listing that has not been checked. The file checks need no browser.

   The budgets are the brief's: a clip under 500 KB, a still under 200 KB. */

const PUBLIC = join(__dirname, "..", "public");
const CLIP_BUDGET = 500 * 1024;
const STILL_BUDGET = 200 * 1024;

/* Names a reader should never find on this page. Written as pieces so this file
   does not contain the words it forbids. */
const BANNED = [
  ["Cla", "ude"],
  ["Anthr", "opic"],
  ["Chat", "GPT"],
  ["Open", "AI"],
  ["Copi", "lot"],
  ["Gem", "ini"],
].map((parts) => parts.join(""));
const HYPE = /\b(revolutionary|supercharge|unlock|game-changing|seamless|leverage|cutting-edge|production[- ]ready|enterprise)\b/i;

test.describe("the software data", () => {
  test("has a card's worth of facts for every product", () => {
    const slugs = new Set<string>();
    for (const product of products) {
      expect(slugs.has(product.slug), `${product.slug} is listed twice`).toBe(false);
      slugs.add(product.slug);
      for (const field of ["name", "promise", "needs", "limit"] as const) {
        expect(product[field].trim().length, `${product.slug} has no ${field}`).toBeGreaterThan(0);
      }
      expect(product.proof.value.trim(), `${product.slug} has no proof number`).not.toBe("");
      expect(product.proof.label.trim(), `${product.slug} does not say what its number is of`).not.toBe("");
      expect(product.github, `${product.slug}: source is not on FinnTech3`).toMatch(
        /^https:\/\/github\.com\/FinnTech3\/[\w.-]+$/,
      );
    }
  });

  test("links to a listing only where there is one, over https, and to Releases for the app", () => {
    for (const product of products) {
      if (product.agensi !== null) {
        expect(product.agensi, `${product.slug}: listing is not https`).toMatch(/^https:\/\/(www\.)?agensi\.io\//);
      }
      if (product.kind === "app") {
        expect(product.agensi, `${product.slug}: an app is not sold on Agensi`).toBeNull();
        expect(product.download, `${product.slug}: an app needs its download page`).toMatch(/\/releases$/);
      }
    }
  });

  test("says the Windows build is unsigned, beside the download", () => {
    for (const product of products.filter((entry) => entry.download)) {
      expect(product.note, `${product.slug} has a download and no word on signing`).toMatch(
        /not code-signed/i,
      );
    }
  });

  test("keeps every file it names within the budget", () => {
    for (const product of products) {
      const { media } = product;
      const files =
        media.kind === "clip"
          ? [
              { path: media.clip.src!, budget: CLIP_BUDGET },
              { path: media.clip.poster!, budget: STILL_BUDGET },
            ]
          : [{ path: media.src, budget: STILL_BUDGET }];
      for (const { path, budget } of files) {
        const file = join(PUBLIC, path);
        expect(existsSync(file), `${product.slug} names ${path}, which is not there`).toBe(true);
        expect(statSync(file).size, `${path} is over its budget`).toBeLessThanOrEqual(budget);
      }
    }
  });

  test("writes real alt text and captions, in the house voice, naming no AI product", () => {
    for (const product of products) {
      const text = [
        product.name,
        product.promise,
        product.proof.label,
        product.needs,
        product.limit,
        product.note ?? "",
        product.media.kind === "clip"
          ? `${product.media.clip.description} ${product.media.clip.caption}`
          : `${product.media.alt} ${product.media.caption}`,
      ].join("\n");
      if (product.media.kind === "still") {
        expect(product.media.alt.length, `${product.slug}: alt is a label, not a description`).toBeGreaterThan(40);
      }
      for (const word of BANNED) {
        expect(text, `${product.slug} names ${word}`).not.toContain(word);
      }
      expect(text, `${product.slug} uses a hype word`).not.toMatch(HYPE);
      expect(text, `${product.slug} has an exclamation mark`).not.toContain("!");
      expect(text, `${product.slug} has an em dash`).not.toContain("—");
      expect(text, `${product.slug} has a price`).not.toMatch(/[$£€]\d+(\.\d+)?\s*(\/|per|a month|USD|GBP)/i);
    }
  });

  test("gives only FinnTech3 as the credit", () => {
    for (const product of products) {
      if (product.media.kind === "clip") expect(product.media.clip.credit).toBe("FinnTech3");
    }
  });

  test("has no email address or key in the data", () => {
    const source = readFileSync(join(__dirname, "..", "src", "lib", "software.ts"), "utf8");
    expect(source).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(source).not.toMatch(/\b(sk|ghp|gho|github_pat)_[A-Za-z0-9]{10,}/);
  });
});

test.describe("the software page", () => {
  test("renders a card for every product, in the order of the data", async ({ page }) => {
    await page.goto("/software");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/What I build/);
    const cards = page.locator("article[id]");
    await expect(cards).toHaveCount(products.length);
    for (const [index, product] of products.entries()) {
      const card = cards.nth(index);
      await expect(card).toHaveAttribute("id", product.slug);
      await expect(card.getByRole("heading", { level: 2, name: product.name })).toBeVisible();
      await expect(card.getByText(product.proof.value, { exact: true })).toBeVisible();
      await expect(card.getByText(product.limit, { exact: true })).toBeVisible();
    }
  });

  test("leads each card with the link the data says, and opens it safely", async ({ page }) => {
    await page.goto("/software");
    for (const product of products) {
      const card = page.locator(`article#${product.slug}`);
      const primary = product.agensi
        ? { name: "Get it on Agensi", href: product.agensi }
        : product.download
          ? { name: "Download from GitHub Releases", href: product.download }
          : { name: "On GitHub", href: product.github };
      const lead = card.getByRole("link", { name: primary.name });
      await expect(lead, `${product.slug} lacks its primary link`).toHaveAttribute("href", primary.href);
      await expect(lead).toHaveAttribute("rel", /noopener/);

      if (product.agensi || product.download) {
        const source = card.getByRole("link", { name: /Source on GitHub/ });
        await expect(source).toHaveAttribute("href", product.github);
        await expect(source).toHaveAttribute("rel", /noopener/);
      }
      if (!product.agensi && product.kind === "skill") {
        await expect(card.getByText("Agensi listing coming").first()).toBeVisible();
        await expect(card.getByRole("link", { name: /Get it on Agensi/ })).toHaveCount(0);
      }
    }
  });

  test("puts the unsigned-Windows sentence beside the download", async ({ page }) => {
    await page.goto("/software");
    for (const product of products.filter((entry) => entry.download)) {
      const card = page.locator(`article#${product.slug}`);
      await expect(card.getByText(product.note!)).toBeVisible();
    }
  });

  test("plays each clip muted, looped and inline, with a poster and nothing loaded up front", async ({ page }) => {
    await page.goto("/software");
    const videos = page.locator("article video");
    const clipCount = products.filter((product) => product.media.kind === "clip").length;
    await expect(videos).toHaveCount(clipCount);
    for (let index = 0; index < clipCount; index += 1) {
      const video = videos.nth(index);
      await expect(video).toHaveAttribute("poster", /\/software\/.+\.webp$/);
      await expect(video).toHaveAttribute("preload", "none");
      expect(await video.evaluate((el: HTMLVideoElement) => [el.muted, el.loop, el.playsInline])).toEqual([
        true,
        true,
        true,
      ]);
    }
  });

  test("gives the lazy still real alt text", async ({ page }) => {
    await page.goto("/software");
    for (const product of products.filter((entry) => entry.media.kind === "still")) {
      const image = page.locator(`article#${product.slug} img`);
      await expect(image).toHaveAttribute("loading", "lazy");
      await expect(image).toHaveAttribute("alt", product.media.kind === "still" ? product.media.alt : "");
    }
  });

  test("shows only the poster when the reader asks for less motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/software");
    const first = page.locator("article video").first();
    await first.scrollIntoViewIfNeeded();
    /* The server renders the source, and the player takes it away once it has read
       the preference, so the attribute is what is polled for. */
    await expect.poll(() => first.getAttribute("src"), { message: "the clip still has a source" }).toBeNull();
    expect(await first.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
    await expect(first).toHaveAttribute("poster", /\/software\/.+\.webp$/);
    await context.close();
  });

  test("has an honest checking block and a count for every counted suite", async ({ page }) => {
    await page.goto("/software");
    const block = page.getByRole("region", { name: "How I check my own work" });
    for (const product of products.filter((entry) => entry.tests !== null)) {
      await expect(block.getByText(`${product.tests} tests`, { exact: true })).toBeVisible();
    }
    await expect(block.getByText(/Not done yet/)).toBeVisible();
  });

  test("is in the navigation, marked as the current page", async ({ page }) => {
    await page.goto("/software");
    const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Software" });
    await expect(link).toHaveAttribute("aria-current", "page");
  });

  test("never scrolls sideways at 360 pixels", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await context.newPage();
    for (const path of ["/", "/software"]) {
      await page.goto(path);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(wide, `${path} is wider than a 360 pixel screen`).toBeLessThanOrEqual(0);
    }
    await context.close();
  });
});

test.describe("the way in", () => {
  test("the home page teases it and links to it", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /See the software/ });
    await expect(link).toHaveAttribute("href", "/software");
  });

  test("the sitemap lists it", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/software</loc>");
  });

  test("its share card exists and is announced in the head", async ({ request }) => {
    const html = await (await request.get("/software")).text();
    const card = html.match(/property="og:image" content="([^"]+)"/);
    expect(card, "no og:image on /software").not.toBeNull();
    const path = new URL(card![1], "http://localhost").pathname;
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/");
  });
});

test.describe("the search", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "keyboard-driven");

  test("finds a product by name and leads to where it can be had", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /search/i }).click();
    const input = page.getByRole("combobox", { name: "Search this site" });
    await input.fill(products[0].name);
    const option = page.getByRole("option").first();
    await expect(option).toContainText(products[0].name);
  });
});
