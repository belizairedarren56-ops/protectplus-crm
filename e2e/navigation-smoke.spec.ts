import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

const ROUTES: { path: string; heading: string }[] = [
  { path: "/", heading: "Dashboard" },
  { path: "/clients", heading: "Clients" },
  { path: "/leads", heading: "Lead Pipeline" },
  { path: "/quotes", heading: "Quotes" },
  { path: "/policies", heading: "Policies" },
  { path: "/tasks", heading: "Tasks" },
  { path: "/documents", heading: "Documents" },
  { path: "/reports", heading: "Reports" },
  { path: "/settings", heading: "Settings" },
];

for (const route of ROUTES) {
  test(`${route.path} renders its heading with no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();

    expect(errors, `console errors on ${route.path}: ${errors.join("\n")}`).toEqual([]);
  });
}
