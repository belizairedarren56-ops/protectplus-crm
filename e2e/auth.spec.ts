import { expect, test } from "@playwright/test";

// This spec needs a real, configured Supabase instance behind proxy.ts —
// it's a no-op everywhere else (see the graceful-degrade check at the top
// of proxy.ts), so there's nothing to test without one. Run via the
// `supabase` CI job (supabase start + npm run bootstrap-admin first), or
// locally the same way.
const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

test.describe("authentication", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Requires a configured Supabase instance — see tests/rls and the `supabase` CI job."
  );

  test("an unauthenticated visit to a protected route redirects to /login", async ({ page }) => {
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("an invalid login shows an error and does not navigate away", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.test");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a valid login reaches the dashboard, and clearing the session re-engages the gate", async ({
    page,
    context,
  }) => {
    const email = process.env.E2E_TEST_USER_EMAIL;
    const password = process.env.E2E_TEST_USER_PASSWORD;
    test.skip(
      !email || !password,
      "Requires E2E_TEST_USER_EMAIL/E2E_TEST_USER_PASSWORD (seeded by `npm run bootstrap-admin` in CI)."
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("http://localhost:3000/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    // Signed in, but still localStorage-backed — the banner must say so.
    await expect(page.getByText(/still stored locally in this browser/)).toBeVisible();

    // There's no logout control in the UI yet (that's Phase 4's User
    // Management/Topbar work) — clearing cookies simulates the session
    // ending and proves the gate re-engages rather than staying open.
    await context.clearCookies();
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/login$/);
  });
});
