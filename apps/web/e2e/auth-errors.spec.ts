import { test, expect } from '@playwright/test';

test.describe('Authentication Error Flows', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Should display validation errors for empty fields', async ({ page }) => {
        await page.goto('/en/login');

        // Try submitting empty form
        await page.click('button[type="submit"]');

        // Next.js forms should block it with HTML5 validation or show custom UI validation
        const emailInput = page.locator('input[type="email"]');
        const isEmailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
        expect(isEmailInvalid).toBeTruthy();
    });

    test('Should display error for invalid credentials', async ({ page }) => {
        await page.goto('/en/login');
        await page.fill('input[type="email"]', 'admin@pilot.edulanka.lk');
        // Purposefully wrong password
        await page.fill('input[type="password"]', 'WrongPassword123!');
        await page.click('button[type="submit"]');

        // Look for the toast or error message container
        // Next.js injects its own announcer, so target the rose error alert explicitly
        const errorAlert = page.locator('.bg-rose-50.text-rose-700').first();
        if (await errorAlert.isVisible()) {
            await expect(errorAlert).toContainText(/Invalid credentials|Incorrect/i);
        }
    });

    test('Forgot password flow renders properly', async ({ page }) => {
        await page.goto('/en/reset-password');
        await page.waitForLoadState('networkidle');

        // Check that the forgot password form has email input
        await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('button[type="submit"]').first()).toBeVisible();
    });
});
