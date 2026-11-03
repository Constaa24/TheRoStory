import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Moments (text stories) and Read along (films), with test data injected
 * into real stories' responses, so these run before any story has them and
 * never write anything. Film playback isn't covered here: the bundled
 * Chromium has no H.264 decoder, so these stop short of pressing play.
 */
const ESSAY = 'art_ee60d4bc-146f-4773-b891-91bdf287f9cb';
const FILM = 'art_c2d6a6bf-9009-4829-a34d-18c906cf55d9';
const SUB = 'https://onenyxkwpeayxewbiuvs.supabase.co/storage/v1/object/public/articles/stories/subtitles/e2e/';

const vtt = (lang: 'en' | 'ro') =>
  'WEBVTT\n\n' +
  Array.from({ length: 12 }, (_, i) => {
    const s = i * 10;
    const t = (x: number) => `00:${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}.000`;
    return `${t(s)} --> ${t(s + 4)}\n${lang === 'en' ? `English line ${i + 1}` : `Replica ${i + 1}`}`;
  }).join('\n\n');

const inject = async (context: BrowserContext, id: string, fields: Record<string, unknown>) => {
  await context.route('**/rest/v1/articles?*', async (route) => {
    const url = route.request().url();
    if (!url.includes(`id=eq.${id}`) || !url.includes('select=*')) return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: Array.isArray(body) ? body.map((r) => ({ ...r, ...fields })) : { ...body, ...fields } });
  });
  await context.route(`${SUB}*.vtt`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/vtt', headers: { 'access-control-allow-origin': '*' }, body: vtt(route.request().url().endsWith('ro.vtt') ? 'ro' : 'en') }));
};

/** Serious and critical axe findings, both themes, as in a11y.spec. */
const blockingViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
};

test.describe('moments', () => {
  test.beforeEach(async ({ context }) => {
    await inject(context, ESSAY, {
      moments: [
        { chapter: 0, when_en: '1878', label_en: 'The first arch' },
        { chapter: 2, when_en: '1936', label_en: 'In stone' },
        { chapter: 4, when_en: 'Today', label_en: 'The gateway' },
      ],
    });
  });

  test('draws the strip under the title', async ({ page }) => {
    await page.goto(`/article/${ESSAY}`);
    const items = page.locator('.sb-moments li');
    await expect(items).toHaveCount(3);
    await expect(items.nth(1)).toHaveText('1936In stone');
    await page.locator('.sb-moments').scrollIntoViewIfNeeded();
    expect(await blockingViolations(page)).toEqual([]);
  });

  test('a moment lands on its chapter and stays there', async ({ page }) => {
    await page.goto(`/article/${ESSAY}`);
    await page.locator('.sb-moments li').nth(1).locator('a').click();
    await expect(page).toHaveURL(/#chapter-3$/);
    await page.waitForTimeout(1000);
    const top = await page.evaluate(() => Math.round(document.getElementById('chapter-3')!.getBoundingClientRect().top));
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(220);
  });
});

test.describe('read along', () => {
  test.beforeEach(async ({ context }) => {
    await inject(context, FILM, {
      subtitles_en_url: `${SUB}en.vtt`,
      subtitles_ro_url: `${SUB}ro.vtt`,
      film_chapters: [{ t: 0, en: 'The children', ro: 'Copiii' }, { t: 60, en: 'The storm', ro: 'Furtuna' }],
    });
  });

  test('offers subtitles, and the transcript by chapter in either language', async ({ page }) => {
    await page.goto(`/article/${FILM}`);
    await expect(page.getByRole('button', { name: 'Subtitles' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Read along' }).click();
    const list = page.locator('.sb-readalong-list');
    await expect(list).toBeVisible();
    await expect(list.locator('.sb-readalong-chapter')).toHaveCount(2);
    await expect(list.locator('.sb-cue')).toHaveCount(12);
    await expect(list.locator('.sb-cue').first()).toHaveText('English line 1');
    await page.getByRole('button', { name: 'Română' }).click();
    await expect(list).toHaveAttribute('lang', 'ro');
    await expect(list.locator('.sb-cue').first()).toHaveText('Replica 1');
    expect(await blockingViolations(page)).toEqual([]);
  });

  test('passes the accessibility checks in light mode too', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('theme', 'light'));
    await page.goto(`/article/${FILM}`);
    await expect(page.locator('html')).toHaveClass(/light/);
    await page.getByRole('button', { name: 'Read along' }).click();
    await expect(page.locator('.sb-readalong-list')).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
  });
});
