import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The accessibility work on this site — contrast tokens, a skip link, ARIA
 * labels, an aria-live region on search — was all written by reading source.
 * None of it had ever been measured in a browser. This is the measurement.
 *
 * Fails on serious and critical violations only. Moderate and minor findings
 * are printed for information: axe flags things there (heading-order inside
 * an editorial layout, for instance) that are judgement calls rather than
 * defects, and a suite that cries wolf gets muted.
 */

const PAGES = [
  { path: '/', name: 'home' },
  { path: '/categories', name: 'categories' },
  // The custom SVG of all 42 counties is the most accessibility-sensitive
  // thing on the site — every county is an interactive path with its own
  // label, and none of it comes from a component library that was audited
  // upstream. It was the largest page missing from this list.
  { path: '/map', name: 'map' },
  // Form-heavy and content-heavy respectively; both were verified clean
  // when first swept, so these entries exist to keep them that way.
  { path: '/auth', name: 'auth' },
  { path: '/my-story', name: 'my-story' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
  { path: '/support', name: 'support' },
  { path: '/contact-us', name: 'contact' },
];

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Waits for the app to have rendered something real, not just the shell. */
const settle = async (page: Page) => {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
  // Let lazy chunks and the first data round-trip land.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
};

const report = (violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) =>
  violations
    .map(
      (v) =>
        `  [${v.impact}] ${v.id}: ${v.help}\n` +
        v.nodes.slice(0, 3).map((n) => `      ${n.target.join(' ')}`).join('\n')
    )
    .join('\n');

for (const locale of [
  { prefix: '', label: 'en' },
  { prefix: '/ro', label: 'ro' },
]) {
  for (const { path, name } of PAGES) {
    const url = `${locale.prefix}${path}` || '/';

    test(`${name} (${locale.label}) has no serious accessibility violations`, async ({ page }) => {
      await page.goto(url);
      await settle(page);

      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      );
      const advisory = results.violations.filter(
        (v) => v.impact !== 'serious' && v.impact !== 'critical'
      );

      if (advisory.length) {
        console.log(`\n${url} — ${advisory.length} advisory finding(s):\n${report(advisory)}`);
      }

      expect(blocking, `\n${url}\n${report(blocking)}\n`).toEqual([]);
    });
  }
}

/**
 * The article reader, which every list on the site exists to lead to, and
 * which none of the checks above ever reached — the routes are `/article/:id`
 * so there is no fixed URL to add to PAGES.
 *
 * The id is discovered rather than hard-coded: the suite runs against a real
 * Supabase project, so pinning one would rot the first time that story was
 * unpublished. If the archive is empty there is nothing to measure and the
 * test says so instead of failing.
 */
const firstArticlePath = async (page: Page, prefix = ''): Promise<string | null> => {
  // '' -> '/', '/ro' -> '/ro/'; both are real routes, so no fallback needed.
  await page.goto(`${prefix}/`);
  await settle(page);
  const href = await page
    .locator('a[href*="/article/"]')
    .first()
    .getAttribute('href')
    .catch(() => null);
  return href;
};

for (const locale of [
  { prefix: '', label: 'en' },
  { prefix: '/ro', label: 'ro' },
]) {
  test(`an article page (${locale.label}) has no serious accessibility violations`, async ({ page }) => {
    const path = await firstArticlePath(page, locale.prefix);
    test.skip(!path, 'no published articles in this environment');

    await page.goto(path as string);
    await settle(page);
    // Confirm we are on the reader, not a redirect back to a list.
    await expect(page).toHaveURL(/\/article\//);

    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    const advisory = results.violations.filter(
      (v) => v.impact !== 'serious' && v.impact !== 'critical'
    );

    if (advisory.length) {
      console.log(`\n${path} — ${advisory.length} advisory finding(s):\n${report(advisory)}`);
    }

    expect(blocking, `\n${path}\n${report(blocking)}\n`).toEqual([]);
  });
}

test('an article page (light mode) has no serious accessibility violations', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('theme', 'light'));
  const path = await firstArticlePath(page);
  test.skip(!path, 'no published articles in this environment');

  await page.goto(path as string);
  await settle(page);
  await expect(page.locator('html')).toHaveClass(/light/);

  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  expect(blocking, `\n${path} (light)\n${report(blocking)}\n`).toEqual([]);
});

test('the language switch reaches a real Romanian page, not a 404', async ({ page }) => {
  // The locale prefix is applied through Router's basename, so a mistake here
  // produces a page that renders but is silently the wrong tree.
  await page.goto('/ro/privacy');
  await settle(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
});

test('English pages declare English', async ({ page }) => {
  await page.goto('/privacy');
  await settle(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

/**
 * Light mode specifically. The contrast remediation was done here — 13 of 19
 * token pairs were failing AA before it — and every check of it until now was
 * a luminance calculation against the stylesheet rather than a measurement of
 * a rendered page. defaultTheme is dark, so light has to be asked for.
 */
for (const { path, name } of PAGES) {
  test(`${name} (light mode) has no serious accessibility violations`, async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('theme', 'light'));
    await page.goto(path);
    await settle(page);
    await expect(page.locator('html')).toHaveClass(/light/);

    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(blocking, `
${path} (light)
${report(blocking)}
`).toEqual([]);
  });
}
