import { test, expect } from "@playwright/test";
test("expanded homepage preserves content and supports accessible interactions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A simpler way to create." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Educators", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Educators", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "One lesson. A clearer takeaway." }),
  ).toBeVisible();
  const question = page
    .locator("summary")
    .filter({ hasText: "Does Clipmax create a voice-over recording?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("No. Each clip can include original commentary", {
      exact: false,
    }),
  ).toBeVisible();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("link", { name: "Explore Clipmax", exact: true }),
    ).toBeVisible();
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `test-results/home-${width}.png`,
        fullPage: true,
      });
  }
  expect(
    await page
      .locator("[data-reveal]")
      .evaluateAll((nodes) =>
        nodes.every((node) => getComputedStyle(node).opacity === "1"),
      ),
  ).toBe(true);
});
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
  await page.getByLabel("Password", { exact: true }).fill("testpassword123");
  await page.getByLabel("Confirm password").fill("testpassword123");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
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

test("Google sign-in uses its original multicolor mark on a neutral button", async ({ page }) => {
  await page.goto("/sign-in");
  const google = page.getByRole("button", { name: "Continue with Google" });
  await expect(google).toBeVisible();
  const background = await google.evaluate(
    (button) => getComputedStyle(button).backgroundColor,
  );
  expect(background).toBe("rgb(255, 255, 255)");
  const logoColors = await google.locator("svg path").evaluateAll((paths) =>
    paths.map((path) => path.getAttribute("fill")),
  );
  expect(logoColors).toEqual(["#EA4335", "#4285F4", "#FBBC05", "#34A853"]);
});

test("six-digit email verification screen allows code entry and shows resend control", async ({ page }) => {
  await page.goto("/verify-email?email=example%40test.invalid");
  await expect(page.getByRole("heading", { name: "Check your inbox." })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue("example@test.invalid");
  const code = page.getByLabel("Verification code");
  await code.fill("12a34 56");
  await expect(code).toHaveValue("123456");
  await expect(page.getByRole("button", { name: "VERIFY EMAIL" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Resend code/ })).toBeVisible();
});
