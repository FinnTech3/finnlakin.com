import { expect, test, type Page } from "@playwright/test";

function paletteDialog(page: Page) {
  return page.getByRole("dialog", { name: "Search this site" });
}

function trigger(page: Page) {
  return page.getByRole("button", { name: /search/i });
}

/* Opens by clicking the trigger rather than pressing the shortcut. Playwright
   retries a click until the handler exists, so this is immune to hydration
   timing, whereas retrying the shortcut is not: the shortcut toggles, so a
   retry that fires while the panel is still loading closes it again. The
   shortcut gets its own test below. */
async function openPalette(page: Page) {
  const dialog = paletteDialog(page);
  await trigger(page).click();
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("command palette", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "keyboard-driven");

  test("filters and navigates on Enter", async ({ page }) => {
    await page.goto("/");
    await expect(paletteDialog(page)).toBeHidden();

    const dialog = await openPalette(page);
    const input = page.getByRole("combobox", { name: "Search this site" });
    await expect(input).toBeFocused();

    await input.fill("eleven thousand");
    await expect(dialog.getByRole("option")).toHaveCount(1);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/writing\/marked-to-model$/);
    await expect(dialog).toBeHidden();
  });

  test("the keyboard shortcut opens it, and toggles it shut again", async ({ page }) => {
    await page.goto("/");

    /* Open and close once through the button first. That guarantees the page
       has hydrated and the panel chunk has arrived, so what this then tests is
       the shortcut itself rather than load timing. */
    await openPalette(page);
    await page.keyboard.press("Escape");
    await expect(paletteDialog(page)).toBeHidden();

    await page.keyboard.press("ControlOrMeta+k");
    await expect(paletteDialog(page)).toBeVisible();

    await page.keyboard.press("ControlOrMeta+k");
    await expect(paletteDialog(page)).toBeHidden();
  });

  test("closes on Escape and returns focus to the trigger", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);

    await page.keyboard.press("Escape");
    await expect(paletteDialog(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
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
    await dialog.getByRole("option", { name: /^CV$/ }).click();

    await expect(page).toHaveURL(/\/cv$/);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Finn Lakin");
  });

  test("reports no match rather than an empty list", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);
    await page.getByRole("combobox", { name: "Search this site" }).fill("zzzzzz");
    await expect(page.getByText(/Nothing matches/)).toBeVisible();
  });

  test("exposes combobox and listbox semantics that track the arrow keys", async ({ page }) => {
    await page.goto("/");
    const dialog = await openPalette(page);

    const input = page.getByRole("combobox", { name: "Search this site" });
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await expect(input).toHaveAttribute("aria-autocomplete", "list");

    const listId = await input.getAttribute("aria-controls");
    expect(listId).toBeTruthy();
    await expect(dialog.getByRole("listbox")).toHaveAttribute("id", listId!);

    const first = await input.getAttribute("aria-activedescendant");
    expect(first).toBeTruthy();
    await expect(dialog.locator(`#${first}`)).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("ArrowDown");
    const second = await input.getAttribute("aria-activedescendant");
    expect(second, "arrowing down should move the active option").not.toBe(first);
    await expect(dialog.locator(`#${second}`)).toHaveAttribute("aria-selected", "true");
    await expect(dialog.locator(`#${first}`)).toHaveAttribute("aria-selected", "false");
  });
});

test("the palette is reachable without a keyboard", async ({ page }) => {
  /* Runs on the Pixel 5 project too. A phone has no meta key, so the button is
     the only way in and it has to be a real touch target. */
  await page.goto("/");
  const button = trigger(page);
  const box = await button.boundingBox();
  expect(box?.height ?? 0, "touch target is too short").toBeGreaterThanOrEqual(24);

  await button.click();
  await expect(paletteDialog(page)).toBeVisible();
});
