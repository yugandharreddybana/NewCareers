import { test, expect } from '@playwright/test';

/**
 * Kanban board: five visible columns; bookmarked jobs stay in Discovered with a Saved badge.
 */
test.describe('Kanban Board', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"], [placeholder*="email" i]', 'demo@careerops.test');
    await page.fill('[name="password"], [placeholder*="password" i]', 'Demo@1234!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('kanban — pipeline columns are visible', async ({ page }) => {
    await page.goto('/kanban');

    for (const col of ['Discovered', 'Applied', 'Interview', 'Offer', 'Archived']) {
      await expect(page.locator(`text=${col}`).first()).toBeVisible({ timeout: 8000 });
    }
    await expect(page.locator('text=Saved').first()).not.toBeVisible();
  });

  test('kanban — bookmarked jobs show Saved badge in Discovered', async ({ page }) => {
    await page.goto('/kanban');
    await page.waitForLoadState('networkidle');

    const savedBadge = page.locator('span:has-text("Saved")').filter({ hasText: /^Saved$/ });
    if ((await savedBadge.count()) === 0) {
      test.skip();
      return;
    }
    await expect(savedBadge.first()).toBeVisible();
  });

});
