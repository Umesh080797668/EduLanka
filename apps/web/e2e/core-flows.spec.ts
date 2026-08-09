import { test, expect } from '@playwright/test';

test.describe('Comprehensive Role Workflows', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('1. Admin Flow: Policy update and user enrollment', async ({ page }) => {
        // 1. Login as School Admin
        await page.goto('/en/login');
        await page.fill('input[type="email"]', 'admin@pilot.edulanka.lk');
        await page.fill('input[type="password"]', 'PilotUser123!');
        await page.click('button[type="submit"]');

        // 2. Navigate to Policy and update grading calendar
        await page.goto('/en/institution-admin/policy');
        const gradingSelect = page.locator('#grading-interval-setting');
        if (await gradingSelect.isVisible()) {
            await gradingSelect.selectOption({ label: '3 Terms' });
        }

        // 3. Navigate to Users and try to trigger enrollment modal
        await page.goto('/en/institution-admin/users');
        await expect(page.locator('h1')).toContainText('Users');
        const enrollBtn = page.locator('#add-user-btn');
        if (await enrollBtn.isVisible()) {
            await enrollBtn.click();
            await expect(page.locator('.modal')).toBeVisible();
            await page.click('.modal-close');
        }
    });

    test('2. Teacher Flow: Class selection and grade entry', async ({ page }) => {
        await page.goto('/en/login');
        await page.fill('input[type="email"]', 'teacher@pilot.edulanka.lk');
        await page.fill('input[type="password"]', 'PilotUser123!');
        await page.click('button[type="submit"]');

        await page.goto('/en/teacher/classes');
        await expect(page.locator('h1')).toContainText('Classes');

        // Simulate clicking the first class grades button
        const firstClassGrades = page.locator('a[href*="/grades"]').first();
        if (await firstClassGrades.isVisible()) {
            await firstClassGrades.click();
            await expect(page).toHaveURL(/.*\/grades.*/);

            // Assert grade entry table exists
            await expect(page.locator('table')).toBeVisible();
        }
    });

    test('3. Parent Flow: Checking student progress and report cards', async ({ page }) => {
        await page.goto('/en/login');
        await page.fill('input[type="email"]', 'parent@pilot.edulanka.lk');
        await page.fill('input[type="password"]', 'PilotUser123!');
        await page.click('button[type="submit"]');

        await page.goto('/en/parent');
        await expect(page.locator('h1')).toContainText('Dashboard');

        // Simulate clicking on the child's profile mapped grades
        const childGrades = page.locator('a[href*="/grades"]').first();
        if (await childGrades.isVisible()) {
            await childGrades.click();
            await expect(page.locator('table')).toBeVisible();
        }
    });

    test('4. Student Flow: Checking grades and term selection', async ({ page }) => {
        await page.goto('/en/login');
        await page.fill('input[type="email"]', 'student@pilot.edulanka.lk');
        await page.fill('input[type="password"]', 'PilotUser123!');
        await page.click('button[type="submit"]');

        await page.goto('/en/student/grades');
        await expect(page.locator('h1')).toContainText('Grades');

        const termSelect = page.locator('#term-selector');
        if (await termSelect.isVisible()) {
            await termSelect.selectOption({ index: 1 });
        }

        const downloadBtn = page.locator('#download-report-btn');
        if (await downloadBtn.isVisible()) {
            await expect(downloadBtn).toBeEnabled();
        }
    });
});
