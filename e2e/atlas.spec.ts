import { test, expect, type Page } from '@playwright/test';

/**
 * The Atlas at /map. It runs against the real archive, so nothing here
 * assumes particular stories, counts or dates — and it holds whether or not
 * the Atlas migration (place and date columns, journeys) has been applied:
 * before it, every story sits at its county and the timeline is empty.
 */

const open = async (page: Page, path = '/map') => {
  await page.goto(path);
  await expect(page.locator('.at-frame')).toBeAttached({ timeout: 20_000 });
};

/** "25 stories match" → 25 */
const matchCount = async (page: Page) => Number((await page.locator('.at-pane .at-count').first().innerText()).match(/\d+/)?.[0]);

test('the list view names every story the map shows', async ({ page }) => {
  await open(page);
  const n = await matchCount(page);
  expect(n).toBeGreaterThan(0);

  await page.locator('[data-view="list"]').click();
  await expect(page.locator('.at-frame')).toBeHidden();
  await expect(page.locator('.at-lv tbody tr:not(.at-era-row)')).toHaveCount(n);
  await expect(page).toHaveURL(/view=list/);
});

test('a theme chosen by keyboard filters the stories and lands in the URL', async ({ page }) => {
  await open(page);
  const all = await matchCount(page);

  await page.locator('#at-btn-theme').focus();
  await page.keyboard.press('Enter');
  // Opening moves focus onto the pressed option ("All").
  await expect(page.locator('#at-pop-theme .at-opt[aria-pressed="true"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');

  await expect(page.locator('#at-pop-theme')).toBeHidden();
  await expect(page.locator('#at-btn-theme')).toBeFocused();
  await expect(page).toHaveURL(/theme=/);
  const chip = page.locator('.at-af-chip[data-clear="theme"]');
  await expect(chip).toBeVisible();
  expect(await matchCount(page)).toBeLessThanOrEqual(all);

  // Removing the chip undoes it, and focus doesn't fall to the top of the page.
  await chip.click();
  await expect(page).not.toHaveURL(/theme=/);
  await expect(page.locator('#at-btn-theme')).toBeFocused();
  expect(await matchCount(page)).toBe(all);
});

test('a story opens a card that links to it, and Escape closes it', async ({ page }) => {
  await open(page);
  const row = page.locator('.at-row').first();
  const title = (await row.locator('.at-row-title').innerText()).trim();
  await row.click();

  const card = page.locator('#at-card-title');
  await expect(card).toHaveText(title);
  await expect(card).toBeFocused();
  await expect(page).toHaveURL(/story=art_/);
  await expect(page.locator('a.at-btn-gold[href*="/article/"]')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(page).not.toHaveURL(/story=/);
});

test('back from a story returns to it on the Atlas', async ({ page }) => {
  await open(page);
  await page.locator('.at-row').first().click();
  const title = (await page.locator('#at-card-title').innerText()).trim();

  await page.locator('a.at-btn-gold[href*="/article/"]').click();
  await expect(page).toHaveURL(/\/article\//);
  await page.goBack();

  await expect(page.locator('#at-card-title')).toHaveText(title, { timeout: 20_000 });
});

test('a county with no story offers a pitch, not a vote', async ({ page }) => {
  await open(page);
  const tab = page.locator('#at-tab-unwritten');
  test.skip(!(await tab.count()), 'every county already has a story');

  await tab.click();
  const chip = page.locator('.at-county-chip').first();
  const county = (await chip.innerText()).trim();
  await chip.click();

  await expect(page.locator('#at-card-title')).toHaveText(county);
  await expect(page.locator('.at-card a[href$="/contact-us"]')).toBeVisible();
  await expect(page.getByText(/vote/i)).toHaveCount(0);
});

test('the timeline range is a pair of keyboard sliders', async ({ page }) => {
  await open(page);
  const from = page.locator('.at-tl-handle').first();
  test.skip(!(await from.count()), 'no story has a date in this environment');

  const start = Number(await from.getAttribute('aria-valuenow'));
  await from.focus();
  await page.keyboard.press('PageUp');
  await expect(from).toHaveAttribute('aria-valuenow', String(start + 100));
  await expect(page.locator('.at-af-chip[data-clear="range"]')).toBeVisible();
  await expect(page).toHaveURL(/from=/);

  await page.keyboard.press('Home');
  await expect(from).toHaveAttribute('aria-valuenow', String(start));
  await expect(page).not.toHaveURL(/from=/);
});
