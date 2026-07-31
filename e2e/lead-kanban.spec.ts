import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "protectplus-leads",
      JSON.stringify([
        {
          id: 1,
          clientName: "Test Prospect",
          insuranceType: "Auto",
          stage: "New",
          producer: "Darren Belizaire",
          priority: "Medium",
          lastContact: new Date().toISOString(),
        },
      ])
    );
  });
});

test("dragging a lead card moves it into a different pipeline stage", async ({ page }) => {
  await page.goto("/leads");

  const card = page.getByText("Test Prospect");
  await expect(card).toBeVisible();

  const newColumnHeader = page.getByText("New", { exact: true });
  const contactedColumnHeader = page.getByText("Contacted", { exact: true });

  const cardBox = await card.boundingBox();
  const targetBox = await contactedColumnHeader.boundingBox();
  if (!cardBox || !targetBox) throw new Error("Could not measure drag source/target");

  // dnd-kit listens for real pointer events (not the HTML5 drag/drop API
  // Playwright's locator.dragTo() uses), so the drag is simulated manually:
  // move onto the card, press, move past the activation distance, move over
  // the target column, then release.
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cardBox.x + cardBox.width / 2 + 15, cardBox.y + cardBox.height / 2 + 15, {
    steps: 5,
  });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 120, { steps: 15 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 120, { steps: 5 });
  await page.mouse.up();

  // The card moved out of the New column and the lead now shows Contacted
  // as its stage — check both to guard against a no-op drag passing by luck.
  await expect(newColumnHeader.locator("xpath=../..")).not.toContainText("Test Prospect");
  await expect(contactedColumnHeader.locator("xpath=../..")).toContainText("Test Prospect");
});
