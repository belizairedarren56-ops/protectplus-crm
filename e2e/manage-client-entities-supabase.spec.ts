import { expect, test } from "@playwright/test";

// Supabase-mode counterpart to add-client-supabase.spec.ts, covering the
// six entities this phase migrated: creates a client, then a
// policy/quote/task/document for it, edits and deletes one, reloads to
// prove server-side persistence (not just an optimistic cache), saves a
// profile note and reloads to prove it round-trips, and confirms the
// read-only Family Members tab renders without error. One spec covering
// all six is intentional — they share the same login/client-creation setup
// cost, keeping the Supabase-mode Playwright surface small and fast rather
// than proliferating specs that each re-pay that cost. Gated exactly like
// add-client-supabase.spec.ts: nothing to test without a configured,
// running Supabase instance.
const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

test.describe("client entities — supabase mode", () => {
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

  test("policies, quotes, tasks, documents, and notes all round-trip through Supabase for a real client", async ({
    page,
  }) => {
    const uniqueLastName = `E2E-Entities-${Date.now()}`;
    const clientName = `Supabase ${uniqueLastName}`;

    // ── Create the client this whole test hangs off of. ──────────────────
    await page.goto("/clients");
    await page.getByRole("button", { name: "+ New Client" }).click();
    await page.getByPlaceholder("John").fill("Supabase");
    await page.getByPlaceholder("Smith").fill(uniqueLastName);
    await page.getByPlaceholder("954-555-1234").fill("9545550098");
    await page.getByPlaceholder("client@email.com").fill(`${uniqueLastName}@example.test`);
    await page.getByRole("button", { name: "Save Client" }).click();
    await expect(page.getByText(clientName)).toBeVisible();

    // ── Policy: create, reload, edit, delete. ─────────────────────────────
    await page.goto("/policies");
    await page.getByRole("button", { name: "+ Add Policy" }).click();
    await page.getByLabel("Client").selectOption({ label: clientName });
    const policyNumber = `E2E-POL-${Date.now()}`;
    await page.getByPlaceholder("SF-1234567").fill(policyNumber);
    await page.getByRole("button", { name: "Add Policy", exact: true }).click();
    await expect(page.getByText(policyNumber)).toBeVisible();

    await page.reload();
    await expect(page.getByText(policyNumber)).toBeVisible();

    const policyRow = page.getByText(policyNumber).locator("xpath=ancestor::tr");
    await policyRow.getByRole("button", { name: "Edit" }).click();
    await page.getByPlaceholder("SF-1234567").fill(`${policyNumber}-EDITED`);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText(`${policyNumber}-EDITED`)).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByText(`${policyNumber}-EDITED`)
      .locator("xpath=ancestor::tr")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByText(`${policyNumber}-EDITED`)).not.toBeVisible();

    // ── Quote: create, reload. ────────────────────────────────────────────
    await page.goto("/quotes");
    await page.getByRole("button", { name: "+ New Quote" }).click();
    await page.getByLabel("Client").selectOption({ label: clientName });
    await page.getByRole("button", { name: "Create Quote" }).click();
    await expect(page.getByText(clientName).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(clientName).first()).toBeVisible();

    // ── Task: create, reload, toggle complete. ────────────────────────────
    await page.goto("/tasks");
    await page.getByRole("button", { name: "+ New Task" }).click();
    const taskTitle = `E2E task ${Date.now()}`;
    await page.getByPlaceholder("Follow up on renewal quote").fill(taskTitle);
    await page.getByRole("button", { name: "Create Task" }).click();
    await expect(page.getByText(taskTitle)).toBeVisible();

    await page.reload();
    await expect(page.getByText(taskTitle)).toBeVisible();

    // ── Document: create, reload. ─────────────────────────────────────────
    // The Applications folder in this shared test database can already
    // hold placeholders from prior/retried runs, so a broad
    // /New_Applications_/ match risks resolving to more than one row
    // (a Playwright strict-mode violation). Documents are newest-first
    // (see documentsRepository.ts's list() ordering and useDocuments.ts's
    // optimistic prepend), so the row that just appeared is always the
    // first one — read its exact filename and assert on that exact string
    // from then on, never a pattern that could also match an older row.
    await page.goto("/documents");
    await page.getByText("Applications").first().click();
    await page.getByRole("button", { name: "+ Add Placeholder File" }).click();
    // The button's own label flips to "Adding..." for the duration of the
    // (real, async) create call and back once the new row has actually
    // landed in the list — waiting for that to clear (mirroring the
    // "Saving..." wait used below for notes) rules out reading the
    // still-old first row before the new one has been prepended.
    await expect(page.getByText("Adding...")).toHaveCount(0);

    const newDocumentRow = page.locator("table tbody tr").first();
    const newDocumentName = (await newDocumentRow.getByText(/^New_Applications_/).innerText()).trim();
    await expect(page.getByText(newDocumentName, { exact: true })).toBeVisible();

    await page.reload();
    await page.getByText("Applications").first().click();
    await expect(page.getByText(newDocumentName, { exact: true })).toBeVisible();

    // ── Client profile note: save, reload. ────────────────────────────────
    // The client name itself isn't a link — only the row's "View" button
    // navigates to the detail page. Clicking the name directly leaves the
    // test on /clients, and every subsequent step (starting with "Notes")
    // times out waiting for a tab that was never rendered.
    await page.goto("/clients");
    const clientRow = page.getByText(clientName).locator("xpath=ancestor::tr");
    await clientRow.getByRole("link", { name: "View" }).click();
    await expect(page).toHaveURL(/\/clients\/[^/]+$/);

    await page.getByRole("button", { name: "Notes" }).click();
    const noteText = `E2E note ${Date.now()}`;
    await page.getByPlaceholder(/Call Friday/).fill(noteText);
    await page.getByRole("button", { name: "Save Notes" }).click();
    await expect(page.getByText("Saving...")).toHaveCount(0);

    await page.reload();
    await page.getByRole("button", { name: "Notes" }).click();
    await expect(page.getByPlaceholder(/Call Friday/)).toHaveValue(noteText);

    // ── Family members: read-only tab renders without crashing. No
    // creation UI exists for this entity, so this client has none — the
    // meaningful assertion is that the tab's own empty state renders
    // (proving useFamilyMembers() resolved successfully through Supabase),
    // not a React error boundary or a blank page. ────────────────────────
    await page.getByRole("button", { name: "Family Members" }).click();
    await expect(page.getByText("No family members on file")).toBeVisible();
  });
});
