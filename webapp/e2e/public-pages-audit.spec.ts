import { test, expect, type Page } from '@playwright/test';

/**
 * Sweeps every public route for broken elements.
 *
 * Exists because the App Store badge shipped broken: the SVG itself was fine,
 * but its URL sat under the `/assets/*` immutable header rule, so a fallback
 * response cached there served text/html for a year and the browser refused to
 * paint it. A 200 is not proof an asset is healthy; content-type and
 * naturalWidth are.
 *
 * Runs against the dev server by default. Point it at production with:
 *   AUDIT_BASE=https://fitrush.io npx playwright test public-pages-audit
 */

const ROUTES = ['/', '/trainers', '/experience', '/safety', '/faq', '/help', '/login', '/signup'];

const AUDIT_BASE = process.env.AUDIT_BASE ?? '';
const url = (route: string) => (AUDIT_BASE ? AUDIT_BASE + route : route);

// Assets answering with HTML are the SPA fallback, i.e. the file is missing.
const ASSET_RE = /\.(svg|png|jpg|jpeg|webp|gif|ico|css|js|woff2?)(\?|$)/i;

function watch(page: Page) {
  const consoleErrors: string[] = [];
  const badResponses: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on('response', (r) => {
    const u = r.url();
    if (r.status() >= 400) badResponses.push(`${r.status()} ${u}`);
    else if (ASSET_RE.test(u) && (r.headers()['content-type'] ?? '').includes('text/html')) {
      badResponses.push(`FALLBACK-HTML (missing asset) ${u}`);
    }
  });
  return { consoleErrors, badResponses };
}

for (const route of ROUTES) {
  test(`public route ${route} renders every element cleanly`, async ({ page }) => {
    const { consoleErrors, badResponses } = watch(page);

    const response = await page.goto(url(route), { waitUntil: 'networkidle' });
    expect(response?.status(), `${route} navigation status`).toBeLessThan(400);

    // Scroll the whole page first: loading="lazy" images below the fold have
    // complete === false until they enter the viewport, which otherwise reads
    // as "broken" and buries the genuine failures.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle');

    // Every <img> must actually paint. naturalWidth === 0 catches the exact
    // failure mode a status-code check misses.
    const brokenImages = await page.evaluate(() =>
      Array.from(document.images)
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => img.currentSrc || img.src));
    expect(brokenImages, `${route} broken images`).toEqual([]);

    expect(badResponses, `${route} failed requests`).toEqual([]);
    expect(consoleErrors, `${route} console errors`).toEqual([]);

    // No placeholder links left behind.
    const deadLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a'))
        .filter((a) => { const h = a.getAttribute('href'); return !h || h === '#'; })
        .map((a) => (a.textContent || '').trim().slice(0, 40) || '(no text)'));
    expect(deadLinks, `${route} placeholder links`).toEqual([]);

    // target=_blank without noopener is a tabnabbing vector.
    const unsafeExternal = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[target="_blank"]'))
        .filter((a) => !(a.getAttribute('rel') ?? '').includes('noopener'))
        .map((a) => a.getAttribute('href') ?? ''));
    expect(unsafeExternal, `${route} target=_blank missing rel=noopener`).toEqual([]);

    // Accessibility floor: images need alt text, controls need a name.
    const imagesMissingAlt = await page.evaluate(() =>
      Array.from(document.images).filter((i) => !i.hasAttribute('alt')).map((i) => i.currentSrc || i.src));
    expect(imagesMissingAlt, `${route} images missing alt`).toEqual([]);

    const namelessControls = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button, a'))
        .filter((el) => !(el.textContent || '').trim()
          && !el.getAttribute('aria-label')
          && !el.getAttribute('title')
          && !el.querySelector('img[alt]:not([alt=""]), svg title'))
        .map((el) => el.tagName.toLowerCase()));
    expect(namelessControls, `${route} controls with no accessible name`).toEqual([]);
  });
}

test('App Store badge renders and points at the App Store', async ({ page }) => {
  await page.goto(url('/'), { waitUntil: 'networkidle' });

  const badge = page.getByAltText('Download FitRush on the App Store');
  await expect(badge).toBeVisible();

  // The regression that started this: a 200 that is actually the HTML fallback.
  const { width, type } = await badge.evaluate(async (img: HTMLImageElement) => {
    const res = await fetch(img.currentSrc || img.src);
    return { width: img.naturalWidth, type: res.headers.get('content-type') ?? '' };
  });
  expect(width, 'badge must actually paint').toBeGreaterThan(0);
  expect(type, 'badge must be served as an image, not the SPA fallback').toContain('image/');

  await expect(badge.locator('xpath=ancestor::a[1]')).toHaveAttribute('href', /apps\.apple\.com/);
});
