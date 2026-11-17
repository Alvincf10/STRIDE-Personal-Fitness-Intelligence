import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill("owner");
  await page.getByLabel("Password").fill("change-me");
  await page.getByRole("button", { name: "Enter dashboard" }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good/, {
    timeout: 20_000,
  });
}

async function primaryNav(page: import("@playwright/test").Page) {
  return page.getByRole("navigation", { name: "Primary" }).locator("visible=true");
}

async function openNavLink(
  page: import("@playwright/test").Page,
  names: RegExp | string
) {
  const nav = await primaryNav(page);
  await nav.getByRole("link", { name: names }).click();
}

async function openSecondary(
  page: import("@playwright/test").Page,
  label: string
) {
  const desktop = page
    .locator("aside")
    .getByRole("link", { name: label });
  if (await desktop.isVisible().catch(() => false)) {
    await desktop.click();
    return;
  }
  await page.getByRole("button", { name: "More" }).locator("visible=true").first().click();
  await page.getByRole("dialog").getByRole("link", { name: label }).click();
}

test.describe("STRIDE dashboard", () => {
  test("login and land on Home", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good/);
    await expect(page.getByText("VO2 Max", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent runs" })).toBeVisible();
  });

  test("friendly navigation reaches core pages", async ({ page }) => {
    await signIn(page);

    await openNavLink(page, /^(My Activities|Runs)$/);
    await expect(page).toHaveURL(/\/activities/);
    await expect(page.getByRole("heading", { name: "Every step, saved" })).toBeVisible();

    await openNavLink(page, /^Coach$/);
    await expect(page).toHaveURL(/\/coach/);
    await expect(
      page.getByRole("heading", { name: "Today's training suggestion" })
    ).toBeVisible();

    await openNavLink(page, /^(My Journey|Journey)$/);
    await expect(page).toHaveURL(/\/journey/);
    await expect(
      page.getByRole("heading", { name: "Progress you can feel" })
    ).toBeVisible();

    await openSecondary(page, "Performance");
    await expect(page).toHaveURL(/\/performance/);
    await expect(
      page.getByRole("heading", { name: "Running DNA & progress" })
    ).toBeVisible();

    await openSecondary(page, "Recovery");
    await expect(page).toHaveURL(/\/recovery/);
    await expect(
      page.getByRole("heading", { name: "Listen to the quiet signals" })
    ).toBeVisible();

    await openSecondary(page, "Goals & Races");
    await expect(page).toHaveURL(/\/goals-races/);
    await expect(page.getByRole("heading", { name: "Aim with evidence" })).toBeVisible();

    await openSecondary(page, "Data Quality");
    await expect(page).toHaveURL(/\/data-quality/);
    await expect(
      page.getByRole("heading", { name: "What Garmin actually gave us" })
    ).toBeVisible();

    await openSecondary(page, "Settings & Garmin");
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  });

  test("unauthorized home redirects to login", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login/);
  });
});
