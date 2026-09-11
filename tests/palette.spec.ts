import { expect, test, type Page } from "@playwright/test";

function paletteDialog(page: Page) {
  return page.getByRole("dialog", { name: "Search this site" });
}

/* The keydown listener only exists once the client bundle has hydrated, so a
   single press can land in the gap after first paint and be lost. Retry until
   it takes rather than sleeping for an arbitrary interval. */
async function openPalette(page: Page) {
  const dialog = paletteDialog(page);
  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  return dialog;
}

/* The palette runs on desktop only; Pixel 5 has no meta key and no keyboard. */
test.describe("command palette", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "keyboard-driven");

  test("opens on the shortcut, filters, and navigates", async ({ page }) => {
    await page.goto("/");
    await expect(paletteDialog(page)).toBeHidden();

    const dialog = await openPalette(page);

    const input = page.getByRole("textbox", { name: "Search this site" });
    await expect(input).toBeFocused();

    await input.fill("eleven thousand");
    const options = dialog.locator("li");
    await expect(options).toHaveCount(1);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/writing\/marked-to-model$/);
    await expect(dialog).toBeHidden();
  });

  test("closes on Escape and returns focus to the trigger", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: /search/i });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Search this site" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("closes when the backdrop is clicked", async ({ page }) => {
    await page.goto("/");
    const dialog = await openPalette(page);

    /* Clicking well outside the panel targets the dialog element itself,
       which is what the backdrop handler keys on. */
    await page.mouse.click(12, 12);
    await expect(dialog).toBeHidden();
  });

  test("internal links inside the palette still navigate", async ({ page }) => {
    /* next/link calls preventDefault() and React delegates to the document, so
       any document-level listener gated on defaultPrevented would kill exactly
       this interaction. There is no such listener; this proves it. */
    await page.goto("/");
    const dialog = await openPalette(page);
    await dialog.getByRole("link", { name: /^CV$/ }).click();

    await expect(page).toHaveURL(/\/cv$/);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Finn Lakin");
  });

  test("reports no match rather than an empty list", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);
    await page.getByRole("textbox", { name: "Search this site" }).fill("zzzzzz");
    await expect(page.getByText(/Nothing matches/)).toBeVisible();
  });
});
