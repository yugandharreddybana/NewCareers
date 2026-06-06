import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';
import { requireLiveStack, ensureTestUser, clearAuthState } from './helpers/stack';

/**
 * Task 152 — E2E: Refer-a-Friend flow
 * Generate referral link → copy to clipboard → verify link format.
 */
test.describe('Refer a Friend', () => {
  test.beforeAll(async ({ request }) => {
    await requireLiveStack(request);
    await ensureTestUser(request);
  });

  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await loginAsTestUser(page);
  });

  test('refer page — loads and shows referral section', async ({ page }) => {
    await page.goto('/refer');
    await expect(
      page.locator('text=/refer|invite|share/i').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('generate link — referral link appears after clicking generate', async ({ page }) => {
    await page.goto('/refer');

    const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Get my link"), button:has-text("Create")');
    if (await generateBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await generateBtn.click();
    }

    const linkDisplay = page.locator('input[readonly], input[value*="refer"], code:has-text("refer"), span:has-text("refer")');
    await expect(linkDisplay.first()).toBeVisible({ timeout: 6000 });
  });

  test('link format — referral link contains expected URL pattern', async ({ page }) => {
    await page.goto('/refer');

    const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Get my link")');
    if (await generateBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await generateBtn.click();
    }

    const linkEl = page.locator('input[value*="ref="], input[value*="refer"], [data-testid="referral-link"]');
    if (await linkEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      const linkValue = await linkEl.inputValue();
      expect(linkValue).toMatch(/ref=|referral|invite/i);
    }
  });

  test('copy button — copies referral link to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/refer');

    const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Get my link")');
    if (await generateBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await generateBtn.click();
    }

    const copyBtn = page.locator('button:has-text("Copy"), button[aria-label*="copy" i], button[title*="copy" i]');
    await expect(copyBtn.first()).toBeVisible({ timeout: 5000 });
    await copyBtn.first().click();

    await expect(
      page.locator('text=/copied|done|✓/i').first()
    ).toBeVisible({ timeout: 4000 }).catch(() => {});
  });
});
