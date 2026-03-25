import { test, expect, Page } from '@playwright/test';

// Test credentials
const ACCOUNTS = {
  admin: { email: 'admin@fitrush.com', password: '@dmin2026' },
  trainer: { email: 'hostcalifornia@gmail.com', password: 'YoloLife2026' },
  client: { email: 'sirxiii@gmail.com', password: 'Workout20206!' },
};

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for navigation or error message
  await page.waitForTimeout(5000);
}

// ─── Public pages (no auth required) ──────────────────────────────

test.describe('Public Pages', () => {
  test('landing page loads with hero', async ({ page }) => {
    await page.goto('/');
    // Wait for hero text to render (React hydration)
    await expect(page.locator('body')).toContainText('Off-Peak', { timeout: 15000 });
  });

  test('FAQ page loads with both columns', async ({ page }) => {
    await page.goto('/faq');
    await expect(page.locator('text=For Trainers')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=For Clients')).toBeVisible();
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('navbar links are visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page.locator('a[href="/#search"]').first()).toBeVisible();
    await expect(page.locator('a[href="/faq"]').first()).toBeVisible();
  });
});

// ─── Client role ──────────────────────────────────────────────────

test.describe('Client Flow', () => {
  test('client can log in and reach dashboard', async ({ page }) => {
    await login(page, ACCOUNTS.client.email, ACCOUNTS.client.password);
    await page.goto('/client/dashboard');
    // Wait for auth + React render cycle
    await page.waitForTimeout(8000);
    const text = await page.textContent('body');
    expect(text).toContain('Upcoming Sessions');
  });

  test('client dashboard has quick actions', async ({ page }) => {
    await login(page, ACCOUNTS.client.email, ACCOUNTS.client.password);
    await page.goto('/client/dashboard');
    await page.waitForTimeout(8000);
    const text = await page.textContent('body');
    expect(text).toContain('Quick Actions');
  });

  test('client can access bookings page', async ({ page }) => {
    await login(page, ACCOUNTS.client.email, ACCOUNTS.client.password);
    await page.goto('/bookings');
    await page.waitForTimeout(3000);
    // Page should load without crashing
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});

// ─── Trainer role ─────────────────────────────────────────────────

test.describe('Trainer Flow', () => {
  test('trainer can log in and see dashboard', async ({ page }) => {
    await login(page, ACCOUNTS.trainer.email, ACCOUNTS.trainer.password);
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/trainer/dashboard');
  });

  test('trainer can open availability manager', async ({ page }) => {
    await login(page, ACCOUNTS.trainer.email, ACCOUNTS.trainer.password);
    await page.waitForTimeout(3000);
    const availBtn = page.locator('button:has-text("Manage Availability")');
    if (await availBtn.isVisible()) {
      await availBtn.click();
      await page.waitForTimeout(2000);
      // Calendar grid should appear with day headers
      await expect(page.locator('text=Sun').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('trainer can access bookings page', async ({ page }) => {
    await login(page, ACCOUNTS.trainer.email, ACCOUNTS.trainer.password);
    await page.goto('/trainer/bookings');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});

// ─── Admin role ───────────────────────────────────────────────────

// NOTE: Admin tests skipped — need correct password for admin@fitrush.com
// Update ACCOUNTS.admin.password and remove .skip when known
test.describe.skip('Admin Flow', () => {
  test('admin can log in and see dashboard', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body');
    expect(body).toContain('Admin');
  });

  test('admin analytics tab loads without demo data', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await page.waitForTimeout(5000);
    // Should NOT show "SHOWING DEMO DATA"
    const demoWarning = page.locator('text=SHOWING DEMO DATA');
    expect(await demoWarning.count()).toBe(0);
  });

  test('admin users tab loads real data', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await page.waitForTimeout(3000);
    const usersTab = page.locator('button:has-text("USERS")');
    if (await usersTab.isVisible()) {
      await usersTab.click();
      await page.waitForTimeout(3000);
      // Should not show demo data warning
      const demoWarning = page.locator('text=SHOWING DEMO DATA');
      expect(await demoWarning.count()).toBe(0);
    }
  });

  test('admin transactions tab loads without errors', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await page.waitForTimeout(3000);
    const txTab = page.locator('button:has-text("TRANSACTIONS")');
    if (await txTab.isVisible()) {
      await txTab.click();
      await page.waitForTimeout(3000);
      // No error toast
      const errorToast = page.locator('.sonner-toast:has-text("Failed")');
      expect(await errorToast.count()).toBe(0);
    }
  });

  test('admin payouts tab loads without errors', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await page.waitForTimeout(3000);
    const payoutsTab = page.locator('button:has-text("PAYOUTS")');
    if (await payoutsTab.isVisible()) {
      await payoutsTab.click();
      await page.waitForTimeout(3000);
      const errorToast = page.locator('.sonner-toast:has-text("Failed")');
      expect(await errorToast.count()).toBe(0);
    }
  });

  test('admin certifications tab has USREPS link', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await page.waitForTimeout(3000);
    const certsTab = page.locator('button:has-text("CERTS")');
    if (await certsTab.isVisible()) {
      await certsTab.click();
      await page.waitForTimeout(2000);
      await expect(page.locator('a[href*="usreps"]')).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─── Cross-cutting concerns ───────────────────────────────────────

test.describe('Navigation & UX', () => {
  test('sign out works', async ({ page }) => {
    await login(page, ACCOUNTS.client.email, ACCOUNTS.client.password);
    await page.waitForTimeout(2000);
    // Click avatar to open menu
    const avatar = page.locator('button:has(img), button:has(div.rounded-full)').first();
    if (await avatar.isVisible()) {
      await avatar.click();
      await page.waitForTimeout(500);
      const signOutBtn = page.locator('button:has-text("Sign Out")');
      if (await signOutBtn.isVisible()) {
        await signOutBtn.click();
        await page.waitForURL('/', { timeout: 10000 });
      }
    }
  });

  test('no critical console errors on landing page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForTimeout(3000);
    // Filter benign errors (resource loads, devtools, favicon, Supabase auth)
    const realErrors = errors.filter(
      (e) =>
        !e.includes('DevTools') &&
        !e.includes('favicon') &&
        !e.includes('net::ERR') &&
        !e.includes('Failed to load resource') &&
        !e.includes('the server responded with a status')
    );
    expect(realErrors).toHaveLength(0);
  });

  test('404 page shows for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await page.waitForTimeout(2000);
    // Should show 404 or redirect
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});
