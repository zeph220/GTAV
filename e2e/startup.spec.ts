import { expect, test } from "@playwright/test";

test("the NOVA CITY procedural 3D scene loads and can enter pause mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "NOVA CITY" })).toBeVisible();
  await expect(page.getByText("Aperçu prêt")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Quartiers de NOVA CITY" })
    .getByText("Downtown")).toBeVisible();
  await expect(page.getByText("8 QUARTIERS")).toBeVisible();

  await page.getByRole("button", { name: /Entrer dans la ville/ }).click();
  await expect(page.getByText("En visite")).toBeVisible();

  await page.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(page.getByText("En pause")).toBeVisible();

  await page.getByRole("button", { name: "Reprendre" }).click();
  await expect(page.getByText("En visite")).toBeVisible();
});
