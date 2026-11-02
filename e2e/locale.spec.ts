import { test, expect } from '@playwright/test';

/**
 * The stored language preference only decides where the bare root "/"
 * goes; every other URL means exactly the language it says. Until November
 * 2026 any English URL bounced a reader with a stored Romanian preference
 * to its Romanian twin: a shared or searched English link never opened in
 * English for anyone who had once visited the Romanian site.
 */
test.describe('stored language preference', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('rostory_lang', 'ro'));
  });

  test('sends the bare root to the Romanian home', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/ro$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
  });

  test('never overrides an English URL', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveURL(/\/privacy$/);
    expect(new URL(page.url()).pathname).toBe('/privacy');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
