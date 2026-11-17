import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * The story editors' Preview and the unsaved copy kept in the browser, as an
 * editor. The session is a stand-in (Supabase Auth and the role are answered
 * here), the shelves are read from the real archive as a visitor, and
 * anything that would write is answered here instead: these tests never
 * change the database.
 */
const EDITOR = '00000000-0000-4000-8000-0000000000e2';

const signInAsEditor = async (context: BrowserContext) => {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: EDITOR, aud: 'authenticated', role: 'authenticated', email: 'editor@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
  };
  const session = {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: EDITOR, exp, role: 'authenticated' })}.sig`,
    refresh_token: 'stand-in', token_type: 'bearer', expires_in: 3600, expires_at: exp, user,
  };
  await context.addInitScript((s) => {
    try { localStorage.setItem('sb-onenyxkwpeayxewbiuvs-auth-token', JSON.stringify(s)); } catch { /* no storage */ }
  }, session);
  await context.route('**/auth/v1/**', (route) => route.fulfill({ json: user }));
  await context.route('**/functions/v1/**', (route) => route.fulfill({ json: {} }));
  await context.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/rest/v1/user_roles')) return route.fulfill({ json: { role: 'admin' } });
    if (url.includes('/rest/v1/profiles')) return route.fulfill({ json: { id: EDITOR, display_name: 'Editor', avatar_url: null } });
    if (url.includes('/rest/v1/favorites')) return route.fulfill({ json: [] });
    if (req.method() !== 'GET' && req.method() !== 'HEAD') return route.fulfill({ status: 204, body: '' });
    // The stand-in token is no key: read the archive as a visitor.
    return route.continue({ headers: { ...req.headers(), authorization: `Bearer ${req.headers().apikey}` } });
  });
};

const kept = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('rostory_story_draft:')).length);

/** Leaving with unsaved changes asks first; these tests mean to leave. */
const reloadAnyway = async (page: Page) => {
  page.once('dialog', (d) => d.accept());
  await page.reload();
};

test.beforeEach(async ({ context }) => {
  await signInAsEditor(context);
});

test('Preview shows the story as readers will, and follows the editor', async ({ context, page }) => {
  await page.goto('/admin/text-story/create');
  const title = page.getByLabel('Title (English)');
  await title.fill('A preview of salt');

  const [preview] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('link', { name: /^Preview/ }).click(),
  ]);
  await expect(preview.getByRole('heading', { level: 1 })).toHaveText(/A preview of salt/);
  const bar = preview.getByRole('region', { name: 'Preview' });
  await expect(bar).toContainText('A draft');
  await expect(bar).toContainText('with your unsaved changes');
  // Nothing on it acts on the story: it isn't saved, or even made, yet.
  await expect(preview.getByRole('button', { name: /Save to your shelf/ })).toBeDisabled();

  await title.fill('A preview of salt and storms');
  await expect(preview.getByRole('heading', { level: 1 })).toHaveText(/salt and storms/);

  // With the editor gone, the preview keeps its last version and says so.
  page.once('dialog', (d) => d.accept());
  await page.goto('/admin');
  await expect(bar).toContainText('The editor is closed');
  await expect(preview.getByRole('heading', { level: 1 })).toHaveText(/salt and storms/);
});

test('unsaved work survives a reload and can be restored', async ({ page }) => {
  await page.goto('/admin/text-story/create');
  const title = page.getByLabel('Title (English)');
  await title.fill('Kept in this browser');
  await expect.poll(() => kept(page)).toBe(1);

  await reloadAnyway(page);
  const offer = page.getByRole('region', { name: 'Unsaved changes' });
  await expect(offer).toBeVisible();
  await expect(title).toHaveValue('');
  await page.getByRole('button', { name: 'Restore them' }).click();
  await expect(title).toHaveValue('Kept in this browser');
  await expect(offer).toHaveCount(0);
});

test('a discarded copy is gone for good', async ({ page }) => {
  await page.goto('/admin/text-story/create');
  await page.getByLabel('Title (English)').fill('Not wanted');
  await expect.poll(() => kept(page)).toBe(1);

  await reloadAnyway(page);
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  expect(await kept(page)).toBe(0);

  await page.reload();
  await expect(page.getByLabel('Title (English)')).toHaveValue('');
  await expect(page.getByRole('region', { name: 'Unsaved changes' })).toHaveCount(0);
});
