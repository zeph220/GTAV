import { expect, test } from "@playwright/test";

test("the NOVA CITY procedural 3D scene loads and can enter pause mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "NOVA CITY" })).toBeVisible();
  await expect(page.getByText("Aperçu prêt")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Quartiers de NOVA CITY" })
    .getByText("Downtown")).toBeVisible();
  await expect(page.getByText("8 QUARTIERS")).toBeVisible();

  const canvas = page.locator("canvas");
  await canvas.hover({ position: { x: 420, y: 330 } });
  await page.mouse.down();
  await expect.poll(() => canvas.evaluate((element) => getComputedStyle(element).cursor))
    .toBe("grabbing");
  await page.mouse.move(455, 350, { steps: 3 });
  await page.mouse.up();
  await expect.poll(() => canvas.evaluate((element) => getComputedStyle(element).cursor))
    .toBe("grab");
  await page.mouse.wheel(0, -120);

  await page.getByRole("button", { name: /Entrer dans la ville/ }).click();
  await expect(page.getByText("En visite")).toBeVisible();

  await page.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(page.getByText("En pause")).toBeVisible();

  const pauseToggle = page.locator(".game-panel .primary-button");
  await expect(pauseToggle).toHaveText("Reprendre");
  await pauseToggle.click();
  await expect(page.getByText("En visite")).toBeVisible();
});
