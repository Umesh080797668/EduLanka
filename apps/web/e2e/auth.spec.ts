import { test, expect } from '@playwright/test';

test.describe('Authentication and RBAC flows', () => {
    test('User can visit login page', async ({ page }) => {
        await page.goto('/en/login');
        await expect(page).toHaveTitle(/EduLanka/);
        await expect(page.locator('form')).toBeVisible();
    });

    // Mocked login tests or simple routing checks. Since this is a scaffolding,
    // we would ideally need a seeded database with known credentials.
    // In a real staging environment, we will have seeders.

    test('Prevents unauthorized access to dashboard', async ({ page }) => {
        await page.goto('/en/student');
        // Should be redirected to login
        await expect(page).toHaveURL(/.*\/login/);
    });
});
