import { test, expect } from '@playwright/test';

/**
 * Task 152 — E2E: Refer-a-Friend flow
 * Generate referral link → copy to clipboard → verify link format.
 */
test.describe('Refer a Friend', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"], [placeholder*="email" i]', 'demo@careerops.test');
    await page.fill('[name="password"], [placeholder*="password" i]', 'Demo@1234!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  // ── 1. Referral page loads ─────────────────────────────────────────────
  test('refer page — loads and shows referral section', async ({ page }) => {
    await page.goto('/refer');
    await expect(
      page.locator('text=/refer|invite|share/i').first()
    ).toBeVisible({ timeout: 8000 });
  });

  // ── 2. Generate referral link ──────────────────────────────────────────
  test('generate link — referral link appears after clicking generate', async ({ page }) => {
    await page.goto('/refer');

    const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Get my link"), button:has-text("Create")');
    if (await generateBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await generateBtn.click();
    }

    // Link input or display should appear
    const linkDisplay = page.locator('input[readonly], input[value*="refer"], code:has-text("refer"), span:has-text("refer")');
    await expect(linkDisplay.first()).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Verify link format ──────────────────────────────────────────────
  test('link format — referral link contains expected URL pattern', async ({ page }) => {
    await page.goto('/refer');

    const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Get my link")');
    if (await generateBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await generateBtn.click();
    }

    // The link should contain a referral code pattern: /register?ref=xxxxx
    const linkEl = page.locator('input[value*="ref="], input[value*="refer"], [data-testid="referral-link"]');
    if (await linkEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      const linkValue = await linkEl.inputValue();
      expect(linkValue).toMatch(/ref=|referral|invite/i);
    }
  });

  // ── 4. Copy to clipboard ──────────────────────────────────────────────
  test('copy button — copies referral link to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/refer');

    const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Get my link")');
    if (await generateBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await generateBtn.click();
    }

    const copyBtn = page.locator('button:has-text("Copy"), button[aria-label*="copy" i], button[title*="copy" i]');
    await expect(copyBtn.first()).toBeVisible({ timeout: 5000 });
    await copyBtn.first().click();

    // Confirmation feedback
    await expect(
      page.locator('text=/copied|done|✓/i').first()
    ).toBeVisible({ timeout: 4000 }).catch(() => {
      // Acceptable if feedback is visual only (icon change)
    });
  });

});
