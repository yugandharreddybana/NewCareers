import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';
import { requireLiveStack, ensureTestUser, clearAuthState } from './helpers/stack';

/**
 * Job evaluation modal layering, content, and apply assistant entry points.
 */
test.describe('Job evaluation & skills UI', () => {
  test.beforeAll(async ({ request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);
  });

  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await loginAsTestUser(page);
  });

  test('job detail shows skills for Discovered column', async ({ page }) => {
    await page.goto('/dashboard');
    const jobLink = page.locator('a[href*="/jobs/"]').first();
    if (!(await jobLink.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await jobLink.click();
    await page.waitForURL(/\/jobs\//);
    await page.getByRole('tab', { name: /AI Skills/i }).click();
    await expect(page.getByText('Job Evaluation')).toBeVisible();
    await expect(page.getByText('Skills Coach')).toHaveCount(0);
  });

  test('evaluation modal does not show preview coach banner', async ({ page }) => {
    await page.goto('/dashboard');
    const jobLink = page.locator('a[href*="/jobs/"]').first();
    if (!(await jobLink.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await jobLink.click();
    await page.getByRole('tab', { name: /AI Skills/i }).click();
    await page.getByText('Job Evaluation').click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Preview match — generating full report')).toHaveCount(0);
    await expect(page.getByText('Need the full skills library')).toHaveCount(0);
  });

  test('apply assistant opens modal', async ({ page }) => {
    await page.goto('/dashboard');
    const jobLink = page.locator('a[href*="/jobs/"]').first();
    if (!(await jobLink.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await jobLink.click();
    await page.getByRole('tab', { name: /AI Skills/i }).click();
    const applyCard = page.getByText('Apply Assistant');
    if (!(await applyCard.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await applyCard.click();
    await expect(page.getByTestId('apply-assist-modal')).toBeVisible();
    await expect(page.getByLabel('Application question')).toBeVisible();
  });

  test('kanban shows triage and compare before fetch', async ({ page }) => {
    await page.goto('/kanban');
    await expect(page.getByRole('button', { name: 'Triage Pipeline' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compare Jobs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fetch Jobs' })).toBeVisible();
  });
});
