# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core-flows.spec.ts >> Comprehensive Role Workflows >> 4. Student Flow: Checking grades and term selection
- Location: e2e/core-flows.spec.ts:71:9

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 120000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e3]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - heading "Welcome to EduLanka" [level=1] [ref=e11]
        - paragraph [ref=e12]: Sign in to your school dashboard
      - generic [ref=e13]:
        - paragraph [ref=e17]: Invalid credentials. Please try again.
        - generic [ref=e18]:
          - generic [ref=e19]:
            - generic [ref=e20]: School ID (Tenant)
            - textbox "e.g. a1b2c3d4-0000-0000-0000-000000000001" [ref=e21]: a1b2c3d4-0000-0000-0000-000000000001
          - generic [ref=e22]:
            - generic [ref=e23]: Email Address
            - textbox "you@school.lk" [ref=e24]: student@pilot.edulanka.lk
          - generic [ref=e25]:
            - generic [ref=e26]:
              - generic [ref=e27]: Password
              - link "Forgot password?" [ref=e28] [cursor=pointer]:
                - /url: /reset-password
            - textbox "••••••••" [ref=e29]: PilotUser123!
          - button "Sign In" [ref=e30]
        - paragraph [ref=e31]:
          - text: Don't have an account?
          - link "Register Here" [ref=e32] [cursor=pointer]:
            - /url: /signup
  - alert [ref=e33]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Comprehensive Role Workflows', () => {
  4  |     test.use({ storageState: { cookies: [], origins: [] } });
  5  | 
  6  |     test('1. Admin Flow: Policy update and user enrollment', async ({ page }) => {
  7  |         // 1. Login as School Admin
  8  |         await page.goto('/en/login');
  9  |         await page.fill('input[type="email"]', 'admin@pilot.edulanka.lk');
  10 |         await page.fill('input[type="password"]', 'PilotUser123!');
  11 |         await page.click('button[type="submit"]');
  12 |         await page.waitForURL(/.*\/institution-admin.*/);
  13 | 
  14 |         // 2. Navigate to Policy and update grading calendar
  15 |         await page.goto('/en/institution-admin/policy');
  16 |         const gradingSelect = page.locator('#grading-interval-setting');
  17 |         if (await gradingSelect.isVisible()) {
  18 |             await gradingSelect.selectOption({ label: '3 Terms' });
  19 |         }
  20 | 
  21 |         // 3. Navigate to Users and try to trigger enrollment modal
  22 |         await page.goto('/en/institution-admin/users');
  23 |         await expect(page.locator('h1')).toContainText('Users');
  24 |         const enrollBtn = page.locator('#add-user-btn');
  25 |         if (await enrollBtn.isVisible()) {
  26 |             await enrollBtn.click();
  27 |             await expect(page.locator('.modal')).toBeVisible();
  28 |             await page.click('.modal-close');
  29 |         }
  30 |     });
  31 | 
  32 |     test('2. Teacher Flow: Class selection and grade entry', async ({ page }) => {
  33 |         await page.goto('/en/login');
  34 |         await page.fill('input[type="email"]', 'teacher@pilot.edulanka.lk');
  35 |         await page.fill('input[type="password"]', 'PilotUser123!');
  36 |         await page.click('button[type="submit"]');
  37 |         await page.waitForURL(/.*\/teacher.*/);
  38 | 
  39 |         await page.goto('/en/teacher/classes');
  40 |         await expect(page.locator('h1')).toContainText('Classes');
  41 | 
  42 |         // Simulate clicking the first class grades button
  43 |         const firstClassGrades = page.locator('a[href*="/grades"]').first();
  44 |         if (await firstClassGrades.isVisible()) {
  45 |             await firstClassGrades.click();
  46 |             await expect(page).toHaveURL(/.*\/grades.*/);
  47 | 
  48 |             // Assert grade entry table exists
  49 |             await expect(page.locator('table')).toBeVisible();
  50 |         }
  51 |     });
  52 | 
  53 |     test('3. Parent Flow: Checking student progress and report cards', async ({ page }) => {
  54 |         await page.goto('/en/login');
  55 |         await page.fill('input[type="email"]', 'parent@pilot.edulanka.lk');
  56 |         await page.fill('input[type="password"]', 'PilotUser123!');
  57 |         await page.click('button[type="submit"]');
  58 |         await page.waitForURL(/.*\/parent.*/);
  59 | 
  60 |         await page.goto('/en/parent');
  61 |         await expect(page.locator('h1')).toContainText('Dashboard');
  62 | 
  63 |         // Simulate clicking on the child's profile mapped grades
  64 |         const childGrades = page.locator('a[href*="/grades"]').first();
  65 |         if (await childGrades.isVisible()) {
  66 |             await childGrades.click();
  67 |             await expect(page.locator('table')).toBeVisible();
  68 |         }
  69 |     });
  70 | 
  71 |     test('4. Student Flow: Checking grades and term selection', async ({ page }) => {
  72 |         await page.goto('/en/login');
  73 |         await page.fill('input[type="email"]', 'student@pilot.edulanka.lk');
  74 |         await page.fill('input[type="password"]', 'PilotUser123!');
  75 |         await page.click('button[type="submit"]');
> 76 |         await page.waitForURL(/.*\/student.*/);
     |                    ^ Error: page.waitForURL: Test timeout of 120000ms exceeded.
  77 | 
  78 |         await page.goto('/en/student/grades');
  79 |         await expect(page.locator('h1')).toContainText('Grades');
  80 | 
  81 |         const termSelect = page.locator('#term-selector');
  82 |         if (await termSelect.isVisible()) {
  83 |             await termSelect.selectOption({ index: 1 });
  84 |         }
  85 | 
  86 |         const downloadBtn = page.locator('#download-report-btn');
  87 |         if (await downloadBtn.isVisible()) {
  88 |             await expect(downloadBtn).toBeEnabled();
  89 |         }
  90 |     });
  91 | });
  92 | 
```