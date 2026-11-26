import { expect, test } from "@playwright/test";

test("the NOVA CITY starter screen can start, pause and resume", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "NOVA CITY" })).toBeVisible();
  await expect(page.getByText("Initialisation")).toBeVisible();

  await page.getByRole("button", { name: "Démarrer" }).click();
  await expect(page.getByText("En jeu")).toBeVisible();

  await page.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(page.getByText("En pause")).toBeVisible();

  await page.getByRole("button", { name: "Reprendre" }).click();
  await expect(page.getByText("En jeu")).toBeVisible();
});
