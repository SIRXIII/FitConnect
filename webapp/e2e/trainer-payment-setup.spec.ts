import { test, expect, type Page } from '@playwright/test';
import { requireE2EAccount } from './credentials';

/**
 * Covers the trainer dashboard Stripe card's 3-state contract
 * (see src/lib/stripeStatus.ts) and the text-ink/70 contrast bump on
 * trainer-surface labels. Read-only: never clicks Set Up Payments,
 * Continue Setup, or Manage Payments, since those call the live
 * create-connect-account edge function and would redirect to Stripe.
 */

const trainer = requireE2EAccount('trainer');

const SCRATCH_DIR =
  '/private/tmp/claude-501/-Volumes-Crucial-X9-Developer-FitConnect--claude-worktrees-pt-onboarding-visibility-stripe-fbe31f/82cdb67a-cf1a-48c7-ab38-356d0fd864b9/scratchpad';

// Suffix for the two screenshot files this spec writes, so the same run can be
// repeated against the fixture account in each of its three Stripe states
// (none/incomplete/connected) without overwriting the previous screenshots.
// Defaults to "full" to match a plain, non-state-specific run.
const SCREENSHOT_LABEL = process.env.TRAINER_QA_LABEL ?? 'full';

async function loginAsTrainer(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  // No waitForTimeout: wait for the SPA to leave /login (successful sign-in
  // navigates via react-router to /trainer/dashboard, /admin, etc).
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });
}

/**
 * Extracts the alpha channel from a computed-style color string, or `null` if
 * the string carries no alpha (i.e. the browser flattened it to opaque).
 *
 * Empirically, Chromium resolves this project's `color-mix(in oklab, ...)`
 * Tailwind v4 opacity modifiers to modern slash syntax, e.g.
 * `oklab(0.217785 0.00000996143 0.00000435114 / 0.7)` -- not the legacy
 * `rgba(r, g, b, a)` comma form. Both use a trailing alpha, just with
 * different delimiters, so this handles either.
 */
function parseAlpha(color: string): number | null {
  const slashSyntax = color.match(/\/\s*([\d.]+)\s*\)\s*$/); // oklab()/oklch()/modern rgb()
  if (slashSyntax) return Number(slashSyntax[1]);
  const legacyRgba = color.match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/i);
  if (legacyRgba) return Number(legacyRgba[1]);
  return null;
}

test.describe('Trainer dashboard payment setup card', () => {
  test('payment setup shows exactly one truthful state', async ({ page }) => {
    await loginAsTrainer(page, trainer.email, trainer.password);
    await page.goto('/trainer/dashboard');

    const paymentLabel = page.getByText('Payment Setup', { exact: true }).first();
    await expect(paymentLabel).toBeVisible({ timeout: 15000 });

    const setUpBtn = page.getByRole('button', { name: 'Set Up Payments' });
    const continueBtn = page.getByRole('button', { name: 'Continue Setup' });
    const manageBtn = page.getByRole('button', { name: 'Manage Payments' });

    // Wait for whichever of the three states has settled before reading visibility,
    // so we never sample mid-render.
    await expect(setUpBtn.or(continueBtn).or(manageBtn)).toBeVisible();

    const [setUpVisible, continueVisible, manageVisible] = await Promise.all([
      setUpBtn.isVisible(),
      continueBtn.isVisible(),
      manageBtn.isVisible(),
    ]);
    const visibleCount = [setUpVisible, continueVisible, manageVisible].filter(Boolean).length;
    expect(visibleCount, 'exactly one Stripe setup button should be visible').toBe(1);

    const connectedStatus = page.getByText('Stripe account connected');
    const incompleteStatus = page.getByText('Finish payment setup to start accepting paid bookings');

    let observedState: 'none' | 'incomplete' | 'connected';
    if (manageVisible) {
      observedState = 'connected';
      await expect(connectedStatus).toBeVisible();
      await expect(incompleteStatus).not.toBeVisible();
    } else if (continueVisible) {
      observedState = 'incomplete';
      await expect(incompleteStatus).toBeVisible();
      await expect(connectedStatus).not.toBeVisible();
    } else {
      observedState = 'none';
      await expect(connectedStatus).not.toBeVisible();
      await expect(incompleteStatus).not.toBeVisible();
    }
    console.log(`[trainer-payment-setup] observed Stripe state: ${observedState}`);

    await page.screenshot({ path: `${SCRATCH_DIR}/dashboard-${SCREENSHOT_LABEL}.png`, fullPage: true });

    const paymentCard = paymentLabel.locator('xpath=ancestor::div[contains(@class, "border")][1]');
    await paymentCard.screenshot({ path: `${SCRATCH_DIR}/payment-card-${SCREENSHOT_LABEL}.png` });
  });

  test('labels meet contrast floor', async ({ page }) => {
    await loginAsTrainer(page, trainer.email, trainer.password);
    await page.goto('/trainer/dashboard');

    const paymentLabel = page.getByText('Payment Setup', { exact: true }).first();
    await expect(paymentLabel).toBeVisible({ timeout: 15000 });

    // "Specialty" is another trainer-surface label carrying the same text-ink/70
    // class (src/pages/TrainerDashboard.tsx). Comparing against it sidesteps
    // guessing exactly how Tailwind v4 compiles the opacity modifier (color-mix,
    // rgba, etc) in this Chromium build -- whatever it resolves to, both labels
    // must resolve identically.
    const referenceLabel = page.getByText('Specialty', { exact: true });
    await expect(referenceLabel).toBeVisible();

    const [paymentColor, referenceColor] = await Promise.all([
      paymentLabel.evaluate((el) => getComputedStyle(el).color),
      referenceLabel.evaluate((el) => getComputedStyle(el).color),
    ]);
    console.log(`[trainer-payment-setup] Payment Setup label color: ${paymentColor}`);
    console.log(`[trainer-payment-setup] Specialty label (text-ink/70) color: ${referenceColor}`);

    expect(paymentColor).toBe(referenceColor);

    const alpha = parseAlpha(paymentColor);

    // The old rendering was rgba(26, 26, 26, 0.4) (text-ink/40) -- clearly
    // below the 0.6 floor. If the browser preserved the color-mix() alpha
    // channel (confirmed empirically: Chromium resolves it to
    // oklab(... / 0.7)), assert it directly.
    if (alpha !== null) {
      expect(
        alpha,
        `resolved alpha for ${paymentColor} should be >= 0.6 (text-ink/70 floor, up from the old text-ink/40)`,
      ).toBeGreaterThanOrEqual(0.58);
    } else {
      // Defensive fallback only: some future Chromium version flattened the
      // color to a fully opaque value with no parseable alpha component. In
      // that case the strongest thing left to assert is that it differs from
      // this project's ink color mixed at the old 0.4 ratio.
      const oldFortyOpaque = 'rgb(162, 162, 161)'; // rgba(26,26,26,0.4) over #FDFCFB, pre-computed
      expect(
        paymentColor,
        `${paymentColor} should not match the old flattened text-ink/40 rendering`,
      ).not.toBe(oldFortyOpaque);
    }
  });
});
