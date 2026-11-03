import { test, expect, type Page } from '@playwright/test';

/**
 * Links to a section of a page. In-page anchors (the legal pages' contents,
 * a story's chapters and moments) once landed and then sprang back: a plain
 * <a href="#id"> makes a history entry React Router reports as a Back-style
 * POP with the previous entry's key, and the scroll restorer put the reader
 * back where they had been. It depended on timing, so these wait long enough
 * for any late restore to have happened.
 */
const sectionTop = (page: Page, id: string) =>
  page.evaluate((i) => Math.round(document.getElementById(i)!.getBoundingClientRect().top), id);

test('a contents link lands on its section and stays there', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The contents list is shown from the lg breakpoint up.');
  await page.goto('/privacy');
  const link = page.locator('a[href="#section-11"]').first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/#section-11$/);
  await page.waitForTimeout(1000);
  const top = await sectionTop(page, 'section-11');
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(200);
});

test('a link from another page opens at the section', async ({ page }) => {
  await page.goto('/');
  await page.locator('footer a[href="/privacy#cookies"]').click();
  await expect(page).toHaveURL(/\/privacy#cookies$/);
  await page.waitForTimeout(1000);
  const top = await sectionTop(page, 'cookies');
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(200);
});

test('arriving from outside at a section opens there', async ({ page }) => {
  await page.goto('/terms#pictures');
  await page.waitForTimeout(1000);
  const top = await sectionTop(page, 'pictures');
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(200);
});

test('an ordinary link still opens a page at the top', async ({ page }) => {
  await page.goto('/privacy');
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.locator('footer a[href="/terms"]').click();
  await expect(page).toHaveURL(/\/terms$/);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(5);
});
