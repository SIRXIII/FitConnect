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

test.describe('Admin dashboard — zero Supabase 4xx', () => {
  // Referrals tab (get_referral_leaderboard RPC) is out of Phase 27 scope — unbuilt referral feature, tracked as a separate phase.
  test('all four admin tabs load with zero Supabase 400/404', async ({ page }) => {
    // Capture all Supabase 4xx responses across the admin tab cycle.
    // Exclusions: RPCs for unbuilt features that are out of Phase 27 scope.
    // - get_referral_leaderboard: referral feature is unbuilt (no RPC, no referral tables).
    //   Tracked as a separate follow-up phase. Referrals tab is not one of the 4 target tabs.
    const OUT_OF_SCOPE_RPCS = ['get_referral_leaderboard'];
    const errors: string[] = [];
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('supabase.co') && res.status() >= 400) {
        if (OUT_OF_SCOPE_RPCS.some((rpc) => url.includes(rpc))) return;
        errors.push(`${res.status()} ${url}`);
      }
    });

    await login(page, ADMIN.email, ADMIN.password);
    await page.goto('/admin');
    // Users tab loads on mount — wait for fetchUsers + fetchStats to fire
    await page.waitForTimeout(5000);

    // Reviews tab
    const reviewsTab = page.locator('button:has-text("Review")').first();
    if (await reviewsTab.isVisible({ timeout: 5000 })) {
      await reviewsTab.click();
      await page.waitForTimeout(3000);
    }

    // Support tab
    const supportTab = page.locator('button:has-text("Support")').first();
    if (await supportTab.isVisible({ timeout: 5000 })) {
      await supportTab.click();
      await page.waitForTimeout(3000);
    }

    // Audit tab
    const auditTab = page.locator('button:has-text("Audit")').first();
    if (await auditTab.isVisible({ timeout: 5000 })) {
      await auditTab.click();
      await page.waitForTimeout(3000);
    }

    // SC1: zero Supabase 4xx
    if (errors.length > 0) {
      console.error('Supabase 4xx responses:', errors);
    }
    expect(errors).toHaveLength(0);

    // SC2: tabs render content, not error toasts
    const body = await page.textContent('body');
    expect(body).not.toContain('Failed to load');
  });
});
