import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Plant Pal" })).toBeVisible();
});

test("404 for unknown routes", async ({ page }) => {
  await page.goto("/nonexistent-page-xyz");
  await expect(page.getByText("404")).toBeVisible();
});
