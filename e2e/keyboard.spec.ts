import { test, expect } from '@playwright/test';

/**
 * Keyboard paths that were written by reading code and never once exercised.
 * Focus behaviour in particular cannot be verified by reading — it only fails
 * in a real browser, under a real tab order.
 */

test.describe('skip link', () => {
  test('is the first thing Tab reaches, and is visible once focused', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();

    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('href', '#main');
    // It is positioned off-screen until focused; if it stays hidden, a
    // keyboard user never learns it exists.
    await expect(focused).toBeInViewport();
  });

  test('actually moves focus into the content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // main carries tabIndex={-1} precisely so it can receive focus here.
    await expect(page.locator('main')).toBeFocused();
  });

  test('is localised on the Romanian tree', async ({ page }) => {
    await page.goto('/ro');
    await expect(page.locator('main')).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveText(/Sari la conținut/i);
  });
});

test.describe('focus is always visible', () => {
  test('every stop in the first dozen shows an indicator', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();

    const invisible: string[] = [];

    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');

      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
          outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
          shadow: s.boxShadow !== 'none',
          border: s.borderStyle !== 'none' && parseFloat(s.borderWidth) > 0,
        };
      });

      if (!info) break;
      if (!info.outline && !info.shadow && !info.border) {
        invisible.push(`${info.tag} "${info.label}"`);
      }
    }

    expect(invisible, `no focus indicator on: ${invisible.join(', ')}`).toEqual([]);
  });
});

test.describe('search overlay', () => {
  const openSearch = async (page: import('@playwright/test').Page) => {
    const trigger = page.getByRole('button', { name: /^(Search|Caută)$/ }).first();
    await trigger.click();
    return trigger;
  };

  test('opens, and reports its state to assistive tech', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();

    const trigger = page.getByRole('button', { name: /^(Search|Caută)$/ }).first();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('mounts its live region before there is anything to announce', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
    await openSearch(page);

    // The region must already be in the DOM while it is still empty. A live
    // region inserted together with its text is frequently never announced —
    // screen readers report mutations inside regions they are already
    // watching. This test is why the container is no longer gated behind the
    // query being non-empty.
    const live = page.locator('[role="status"][aria-live="polite"]');
    await expect(live).toHaveCount(1);
    await expect(live).toBeEmpty();
  });

  test('announces results into that region once a query is typed', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
    await openSearch(page);

    const live = page.locator('[role="status"][aria-live="polite"]');
    await page.getByPlaceholder(/Try |Încearcă /).fill('a');

    // One character is below SEARCH_MIN_LENGTH, so the region should carry the
    // "keep typing" hint rather than silently staying blank.
    await expect(live).not.toBeEmpty();
    await expect(live).toContainText(/at least|cel puțin/i);
  });

  test('closes on Escape', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();

    const trigger = await openSearch(page);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('landmarks', () => {
  test('there is exactly one main landmark and it is the skip target', async ({ page }) => {
    await page.goto('/');
    const main = page.locator('main');
    await expect(main).toHaveCount(1);
    await expect(main).toHaveAttribute('id', 'main');
  });
});
