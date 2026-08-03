import { expect, test } from "@playwright/test";

// Supabase-mode counterpart to add-client.spec.ts — exercises the same
// create/list flow, plus archive/restore, against a real local Supabase
// instance and a real signed-in session. Gated exactly like auth.spec.ts:
// nothing to test without a configured, running Supabase instance.
const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

test.describe("clients — supabase mode", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Requires a configured Supabase instance — see tests/rls and the `supabase` CI job."
  );

  test.beforeEach(async ({ page }) => {
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
  });

  test("creating, listing, archiving, and restoring a client round-trips through Supabase", async ({
    page,
  }) => {
    const uniqueLastName = `E2E-${Date.now()}`;

    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();

    await page.getByRole("button", { name: "+ New Client" }).click();
    await page.getByPlaceholder("John").fill("Supabase");
    await page.getByPlaceholder("Smith").fill(uniqueLastName);
    await page.getByPlaceholder("954-555-1234").fill("9545550099");
    await page.getByPlaceholder("client@email.com").fill(`${uniqueLastName}@example.test`);
    await page.getByRole("button", { name: "Save Client" }).click();

    const clientName = `Supabase ${uniqueLastName}`;
    await expect(page.getByText(clientName)).toBeVisible();

    // Temporary diagnostic (Phase 3A round 3): round 2 showed a 400 network
    // error and a URL that stayed on /clients (not a redirect), but the
    // console message alone didn't say which request failed. Capture the
    // exact URL + response body of every failing (>=400) response.
    const failedResponses: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400) {
        response
          .text()
          .then((body) => {
            failedResponses.push(`${response.status()} ${response.url()} :: ${body.slice(0, 800)}`);
          })
          .catch(() => {
            failedResponses.push(`${response.status()} ${response.url()} :: <unreadable body>`);
          });
      }
    });

    // Reload — proves the client was actually persisted server-side, not
    // just held in an optimistic client-only cache.
    await page.reload();
    await page.waitForLoadState("networkidle").catch(() => {});
    const urlAfterReload = page.url();
    const clientVisible = await page.getByText(clientName).isVisible({ timeout: 8000 }).catch(() => false);
    if (!clientVisible) {
      const errorText = await page
        .getByText(/Could not load clients/)
        .textContent()
        .catch(() => null);
      const loadingVisible = await page
        .getByText(/Loading clients/)
        .isVisible()
        .catch(() => false);
      const bodySnippet = (await page.locator("body").innerText().catch(() => "")).slice(0, 1500);
      await page.waitForTimeout(500); // let any in-flight response.text() promises above settle
      throw new Error(
        `Client not visible after reload. url=${urlAfterReload} errorText=${JSON.stringify(errorText)} loadingVisible=${loadingVisible} bodySnippet=${JSON.stringify(bodySnippet)} failedResponses=${JSON.stringify(failedResponses)}`
      );
    }
    await expect(page.getByText(clientName)).toBeVisible();

    // Archive.
    const row = page.getByText(clientName).locator("xpath=ancestor::tr");
    await row.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText(clientName)).not.toBeVisible();

    await page.getByRole("button", { name: /Archived/ }).click();
    const archivedRow = page.getByText(clientName).locator("xpath=ancestor::tr");
    await expect(archivedRow).toBeVisible();

    // Restore.
    await archivedRow.getByRole("button", { name: "Restore" }).click();
    await page.getByRole("button", { name: "Active" }).click();
    await expect(page.getByText(clientName)).toBeVisible();
  });

  test("the local-data banner reflects that client data is live, not local", async ({ page }) => {
    await page.goto("/clients");
    await expect(page.getByText(/Client data is backed by Supabase/)).toBeVisible();
  });
});
