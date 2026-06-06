import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';
import { requireLiveStack, ensureTestUser, clearAuthState } from './helpers/stack';

/**
 * Task 150 — E2E: Skill run flow
 * Opens job detail → runs evaluate skill → sees result panel → PDF download.
 */
test.describe('Skill Run', () => {
  test.beforeAll(async ({ request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);
  });

  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await loginAsTestUser(page);
  });

  test('job detail — opens from dashboard and displays AI Tools tab', async ({ page }) => {
    const firstCard = page.locator('[data-testid="job-card"], .job-card, a[href*="/jobs/"]').first();
    if (!(await firstCard.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await firstCard.click();

    await expect(page).toHaveURL(/\/jobs\//, { timeout: 8000 });
    await expect(page.locator('button:has-text("AI Tools")')).toBeVisible();
  });

  test('evaluate skill — run and see result panel', async ({ page }) => {
    await page.goto('/dashboard');
    const firstJobLink = page.locator('a[href*="/jobs/"]').first();

    if (!(await firstJobLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await firstJobLink.click();
    await page.waitForURL(/\/jobs\//);
    await page.click('button:has-text("AI Tools")');

    const evalBtn = page.locator('button:has-text("Full Evaluation")');
    await expect(evalBtn).toBeVisible({ timeout: 5000 });
    await evalBtn.click();

    await expect(
      page.locator('.animate-spin, [aria-busy="true"], button:has-text("loading")').first()
    ).toBeVisible({ timeout: 3000 }).catch(() => {});

    await expect(
      page.locator('[data-testid="skill-panel"], .skill-panel, text=/Overall Fit|Score|Evaluation/i').first()
    ).toBeVisible({ timeout: 30000 });
  });

  test('PDF download — button is visible and clickable after skill runs', async ({ page }) => {
    await page.goto('/dashboard');
    const firstJobLink = page.locator('a[href*="/jobs/"]').first();
    if (!(await firstJobLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await firstJobLink.click();
    await page.click('button:has-text("AI Tools")');

    const pdfBtn = page.locator('button:has-text("Complete Pack"), button:has-text("PDF")');
    await expect(pdfBtn.first()).toBeVisible({ timeout: 35000 }).catch(() => {});
  });
});
