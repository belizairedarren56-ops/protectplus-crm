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
    // A full reload here re-does the entire cold-start path (proxy.ts's
    // middleware auth check, the browser Supabase client re-reading the
    // session from cookies, the profile query, then the clients query) all
    // against a freshly-started local Postgres/PostgREST stack — slower and
    // more variable under a shared CI runner than the default 30s budget
    // reliably covers. Widened once real CI runs showed both fast (~5s) and
    // slow (~25s+) completions of the same, otherwise-passing flow.
    test.setTimeout(60_000);

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

    // Temporary diagnostic (Phase 3A round 6): with a full 20s wait, the
    // element genuinely never appears (3/3 attempts) — ruling out timing and
    // pointing at a real, deterministic issue. Capture the exact
    // /rest/v1/clients response after reload, whatever its status.
    const clientsResponsePromise = page
      .waitForResponse((r) => r.url().includes("/rest/v1/clients") && r.request().method() === "GET", {
        timeout: 15_000,
      })
      .catch((err) => err);

    // Reload — proves the client was actually persisted server-side, not
    // just held in an optimistic client-only cache.
    await page.reload();
    const clientsResponse = await clientsResponsePromise;
    const clientsResponseInfo =
      clientsResponse instanceof Error
        ? `<no response captured: ${clientsResponse.message}>`
        : `${clientsResponse.status()} ${clientsResponse.url()} :: ${(await clientsResponse.text().catch(() => "<unreadable>")).slice(0, 1000)}`;

    const clientVisible = await page.getByText(clientName).isVisible({ timeout: 20_000 }).catch(() => false);
    if (!clientVisible) {
      const bodySnippet = (await page.locator("body").innerText().catch(() => "")).slice(0, 1000);
      throw new Error(
        `Client not visible after reload. clientsResponse=${clientsResponseInfo} bodySnippet=${JSON.stringify(bodySnippet)}`
      );
    }

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
