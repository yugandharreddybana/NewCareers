import { test, expect } from '@playwright/test';
import {
  expectLoginBrandVisible,
  expectPageTitleContainsNewCareers,
} from './helpers/auth';

test.describe('NewCareers branding', () => {
  test('login page shows CareerOps mock branding and document title', async ({ page }) => {
    await page.goto('/login');
    await expectLoginBrandVisible(page);
    await expect(page).toHaveTitle(/CareerOps/i);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByText('AI-POWERED CAREER INTELLIGENCE')).toBeVisible();
  });

  test('signup page shows CareerOps header and title', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('link', { name: 'CareerOps' })).toBeVisible();
    await expect(page).toHaveTitle(/CareerOps/i);
    await expect(page.getByRole('heading', { name: /^sign up$/i })).toBeVisible();
  });

  test('forgot-password page uses AuthPageShell with NewCareers link', async ({ page }) => {
    await page.goto('/forgot-password');
    const brand = page.getByRole('link', { name: 'NewCareers' });
    await expect(brand).toBeVisible();
    await expect(brand).toHaveAttribute('href', '/');
    await expectPageTitleContainsNewCareers(page);
  });

  test('login page shows create account CTA and intelligence panel copy', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/signup');
    await expect(page.getByText('Continue with Google')).toBeVisible();
    await expect(page.getByText('New to CareerOps?')).toBeVisible();
    await expect(page.getByText('LIVE INTELLIGENCE').first()).toBeVisible();
    await expect(page.getByText('INTELLIGENCE SUITE 2.0')).toBeVisible();
    await expect(page.getByText('Career Path Predictions')).toBeVisible();
    await expect(page.getByText('Career Insights')).toBeVisible();
    await expect(page.getByText('Peer comparisons')).toBeVisible();
    await expect(page.getByText('$22,205 mans')).toBeVisible();
    await expect(page.getByText(/antieinoihdoork oiodioditite/)).toBeVisible();
  });

  test('forgot-password footer links to legal pages', async ({ page }) => {
    await page.goto('/forgot-password');
    const footer = page.getByRole('main');
    await expect(footer.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
    await expect(footer.getByRole('link', { name: /terms of service/i })).toHaveAttribute('href', '/terms');
    await expect(footer.getByRole('link', { name: /help center/i })).toHaveAttribute('href', '/help');
  });

  test('signup page shows executive analytics panel', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByText('Executive Analytics')).toBeVisible();
    await expect(page.getByText('Live Intelligence Feed')).toBeVisible();
    await expect(page.getByText('Your career evaluation')).toBeVisible();
  });
});
