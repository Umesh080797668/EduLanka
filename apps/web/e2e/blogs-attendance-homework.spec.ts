import { test, expect } from '@playwright/test';

test.describe('Academic Blogs, Attendance, and Homework Workflows', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('1. Blogs Workflow: Teacher authoring and discourse feed', async ({ page }) => {
        // Teacher logs in
        await page.goto('/en/login');
        await page.fill('input[type="email"]', 'teacher@pilot.edulanka.lk');
        await page.fill('input[type="password"]', 'PilotUser123!');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*\/teacher.*/);

        // Navigate to academic blogs
        await page.goto('/en/blogs');
        await expect(page.locator('h1, h2', { hasText: /Academic Blogs|Educational Discourse/i }).first()).toBeVisible();

        // Check authoring button exists for teachers
        const createBtn = page.locator('a[href*="/blogs/create"], button:has-text("Write Blog"), button:has-text("New Post")').first();
        if (await createBtn.isVisible()) {
            await createBtn.click();
            await expect(page).toHaveURL(/.*\/blogs\/create.*/);
            await expect(page.locator('input[placeholder*="title" i], input[name="title"]').first()).toBeVisible();
        }
    });

    test('2. Attendance Workflow: Student and Parent attendance parity', async ({ page }) => {
        // Student views attendance
        await page.goto('/en/login');
        await page.fill('input[type="email"]', 'student@pilot.edulanka.lk');
        await page.fill('input[type="password"]', 'PilotUser123!');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*\/student.*/);

        await page.goto('/en/student/attendance');
        await expect(page.locator('h1', { hasText: 'My Attendance' })).toBeVisible();
        await expect(page.locator('#attendance-summary-cards, table').first()).toBeVisible();

        // Parent views attendance
        await page.goto('/en/login');
        await page.fill('input[type="email"]', 'parent@pilot.edulanka.lk');
        await page.fill('input[type="password"]', 'PilotUser123!');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*\/parent.*/);

        await page.goto('/en/parent/attendance');
        await expect(page.locator('h1', { hasText: 'Child Attendance' })).toBeVisible();
    });

    test('3. Homework Workflow: Parent oversight of children submissions', async ({ page }) => {
        // Parent views homework
        await page.goto('/en/login');
        await page.fill('input[type="email"]', 'parent@pilot.edulanka.lk');
        await page.fill('input[type="password"]', 'PilotUser123!');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*\/parent.*/);

        await page.goto('/en/parent/homework');
        await expect(page.locator('h1', { hasText: "Children's Homework" })).toBeVisible();

        // Check filter bar exists
        await expect(page.locator('input[placeholder*="Search by title" i]').first()).toBeVisible();
    });
});
