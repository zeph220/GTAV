import { expect, test } from "@playwright/test";

test("NOVA CITY renders its world, then drives a vehicle and pauses", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "NOVA CITY" })).toBeVisible();
  await expect(page.getByText("Aperçu prêt")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Quartiers de NOVA CITY" })
    .getByText("Downtown")).toBeVisible();
  await expect(page.getByText("8 QUARTIERS")).toBeVisible();
  await expect(page.getByTestId("pedestrian-population")).toHaveText("42 PIÉTONS");

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

  await page.getByRole("button", { name: /Prendre le volant/ }).click();
  await expect(page.getByText("En visite")).toBeVisible();
  await expect(page.getByLabel("Télémétrie du véhicule")).toBeVisible();
  await expect(page.getByTestId("vehicle-speed")).toHaveText("0");

  await page.keyboard.down("w");
  await expect.poll(async () => Number(await page.getByTestId("vehicle-speed").textContent()), {
    timeout: 8000,
  }).toBeGreaterThan(0);
  await page.keyboard.up("w");

  await page.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(page.getByText("En pause")).toBeVisible();

  await page.getByRole("button", { name: "Reprendre" }).click();
  await expect(page.getByText("En visite")).toBeVisible();
});
