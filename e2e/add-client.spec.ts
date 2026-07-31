import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("adding a client shows it in the list and on its profile", async ({ page }) => {
  await page.goto("/clients");
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();

  await page.getByRole("button", { name: "+ New Client" }).click();
  await page.getByPlaceholder("John").fill("Alex");
  await page.getByPlaceholder("Smith").fill("Rivera");
  await page.getByPlaceholder("954-555-1234").fill("9545559999");
  await page.getByPlaceholder("client@email.com").fill("alex.rivera@example.com");
  await page.getByRole("button", { name: "Save Client" }).click();

  await expect(page.getByText("Alex Rivera")).toBeVisible();

  await page.getByRole("link", { name: "View" }).first().click();
  await expect(page.getByRole("heading", { name: "Alex Rivera" })).toBeVisible();

  const tabs = [
    "Policies",
    "Quotes",
    "Tasks",
    "Notes",
    "Documents",
    "Activity Timeline",
    "Family Members",
    "Overview",
  ];
  for (const tab of tabs) {
    await page.getByRole("button", { name: tab }).click();
  }
});

test("a cancelled 'New Client' draft never survives to the next open", async ({ page }) => {
  await page.goto("/clients");

  await page.getByRole("button", { name: "+ New Client" }).click();
  await page.getByPlaceholder("John").fill("Should Not Persist");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "+ New Client" }).click();
  await expect(page.getByPlaceholder("John")).toHaveValue("");
});
