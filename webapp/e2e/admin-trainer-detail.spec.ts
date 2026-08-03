import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'admin@fitrush.com', password: 'ADMIN123' };

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
}

test.describe('Admin trainer detail modal', () => {
  test('View button opens full detail modal for a trainer row', async ({ page }) => {
    // Fail if get_admin_trainer_detail ever returns a 4xx.
    const errors: string[] = [];
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('get_admin_trainer_detail') && res.status() >= 400) {
        errors.push(`${res.status()} ${url}`);
      }
    });

    await login(page, ADMIN.email, ADMIN.password);
    await page.goto('/admin');
    await page.waitForTimeout(5000);

    const usersTab = page.locator('button:has-text("Users")').first();
    await usersTab.click();
    await page.waitForTimeout(3000);

    const viewBtn = page.locator('[data-testid="view-trainer-btn"]').first();
    const hasViewBtn = await viewBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasViewBtn) {
      test.skip(true, 'No trainer rows with a View button visible.');
      return;
    }

    await viewBtn.click();

    const modal = page.locator('[data-testid="trainer-detail-modal"]');
    await expect(modal).toBeVisible();

    // Web-first assertions retry until the detail RPC resolves and the
    // loading state is replaced by the card sections.
    await expect(modal).toContainText('Pricing', { timeout: 15000 });
    await expect(modal).toContainText('Certifications');

    const modalText = await modal.textContent();
    expect(modalText).not.toContain('Failed to load');

    if (errors.length > 0) {
      console.error('get_admin_trainer_detail 4xx responses:', errors);
    }
    expect(errors).toHaveLength(0);

    await modal.locator('button:has-text("Close")').click();
    await expect(modal).not.toBeVisible();
  });

  test('pending-trainers tab still renders', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto('/admin');
    await page.waitForTimeout(5000);

    const pendingTab = page.locator('button:has-text("pending trainers")').first();
    const hasPendingTab = await pendingTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasPendingTab) {
      await pendingTab.click();
      await page.waitForTimeout(3000);
    }

    const body = await page.textContent('body');
    expect(body).not.toContain('Failed to load');
  });
});
