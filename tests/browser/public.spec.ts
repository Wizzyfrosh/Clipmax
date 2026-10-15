import { test, expect } from "@playwright/test";
test("welcome navigation and responsive registration", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Great moments.",
  );
  await page.getByRole("link", { name: "Create your first clip" }).click();
  await expect(
    page.getByRole("heading", { name: "Create your account." }),
  ).toBeVisible();
  await page.getByLabel("Full name").fill("Test Creator");
  await page.getByLabel("Email address").fill("test@example.com");
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill("testpassword123");
  await page.getByLabel("Confirm password").fill("testpassword123");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(
    page.getByRole("textbox", { name: "Password", exact: true }),
  ).toHaveAttribute("type", "text");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, sign in!" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(
    page.getByRole("button", { name: "SEND RESET LINK" }),
  ).toBeVisible();
});
