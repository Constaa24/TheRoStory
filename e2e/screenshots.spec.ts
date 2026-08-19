import { test, expect } from '@playwright/test';

/**
 * Not assertions — a camera.
 *
 * Every visual claim made about this site during its audits was inferred from
 * source, because there was no browser to look with. These files are the
 * record: run the suite, then open e2e/screenshots/ and actually see what
 * shipped. They are also the raw material for a visual diff later, if one is
 * ever wanted.
 *
 * Runs on the desktop project only — the mobile project captures the same
 * routes through its own viewport via the device config.
 */

const SHOTS = [
  { path: '/', name: 'home' },
  { path: '/privacy', name: 'privacy-en' },
  { path: '/ro/privacy', name: 'privacy-ro' },
  { path: '/terms', name: 'terms-en' },
  { path: '/ro/terms', name: 'terms-ro' },
  { path: '/support', name: 'support' },
  { path: '/categories', name: 'categories' },
];

for (const { path, name } of SHOTS) {
  test(`capture ${name}`, async ({ page }, testInfo) => {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    // Settle any entrance animation before the shutter.
    await page.waitForTimeout(600);

    await page.screenshot({
      path: `e2e/screenshots/${testInfo.project.name}-${name}.png`,
      fullPage: true,
    });
  });
}

/**
 * The theme is next-themes with attribute="class" and defaultTheme="dark", so
 * a fresh visitor gets dark whatever their OS says. emulateMedia does nothing
 * here — the first version of this file used it and produced two identical
 * dark screenshots, one of them labelled "light". The preference has to be
 * seeded into localStorage before the app boots.
 */
const withTheme = (theme: 'light' | 'dark') => async (page: import('@playwright/test').Page) => {
  await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
};

for (const theme of ['light', 'dark'] as const) {
  test(`capture privacy in ${theme} mode`, async ({ page }, testInfo) => {
    await withTheme(theme)(page);
    await page.goto('/privacy');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('html')).toHaveClass(new RegExp(theme));
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `e2e/screenshots/${testInfo.project.name}-privacy-${theme}.png`,
      fullPage: true,
    });
  });
}
