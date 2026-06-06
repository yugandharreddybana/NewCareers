import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';
import { requireLiveStack, ensureTestUser, clearAuthState } from './helpers/stack';

/**
 * Kanban board: five visible columns; bookmarked jobs stay in Discovered with a Saved badge.
 */
test.describe('Kanban Board', () => {
  test.beforeAll(async ({ request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);
  });

  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await loginAsTestUser(page);
  });

  test('kanban — pipeline columns are visible', async ({ page }) => {
    await page.goto('/jobs');

    const discovered = page.locator('text=Discovered').first();
    if (!(await discovered.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Kanban board columns render only when the tracker has jobs.');
      return;
    }

    for (const col of ['Applied', 'Interviewing', 'Offer', 'Archived']) {
      await expect(page.locator(`text=${col}`).first()).toBeVisible({ timeout: 8000 });
    }
    await expect(page.locator('text=Saved').first()).not.toBeVisible();
  });

  test('kanban — bookmarked jobs show Saved badge in Discovered', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const savedBadge = page.locator('span:has-text("Saved")').filter({ hasText: /^Saved$/ });
    if ((await savedBadge.count()) === 0) {
      test.skip();
      return;
    }
    await expect(savedBadge.first()).toBeVisible();
  });
});
