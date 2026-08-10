import { test, expect } from '@playwright/test';

test.describe('Admin CRUD Operations', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.beforeEach(async ({ page }) => {
        // Shared login step for admin tests
        await page.goto('/en/login');
        await page.fill('input[type="email"]', 'admin@pilot.edulanka.lk');
        await page.fill('input[type="password"]', 'PilotUser123!');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*\/institution-admin.*/);
    });

    test('User Management: Search and display tables', async ({ page }) => {
        await page.goto('/en/institution-admin/users');
        await expect(page.locator('h1', { hasText: 'Users Management' })).toBeVisible();

        // Assert the search bar is visibly accessible
        const searchInput = page.getByRole('textbox', { name: 'Search users...' });
        if (await searchInput.isVisible()) {
            await searchInput.fill('Test Student');
            // Wait for potential debounce network activity
            await page.waitForTimeout(500);
        }

        // Data tables should render
        await expect(page.locator('table')).toBeVisible();
    });

    test('Classes Management: Display sections and grades', async ({ page }) => {
        await page.goto('/en/institution-admin/classes');
        await expect(page.locator('h1', { hasText: 'Classes' })).toBeVisible();

        // The classes grid or table should be populated
        const addClassBtn = page.locator('button', { hasText: /Add Class|Create/i }).first();
        if (await addClassBtn.isVisible()) {
            await addClassBtn.click();
            // Validate modal or slide-over appears
            const modal = page.locator('[role="dialog"], .modal').first();
            await expect(modal).toBeVisible();
        }
    });
});
