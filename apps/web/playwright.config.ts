import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    timeout: 120000,
    expect: {
        timeout: 15000,
    },
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'], channel: 'chrome' },
        }
    ],
    webServer: [
        {
            command: 'npm run start',
            url: 'http://localhost:3000',
            reuseExistingServer: !process.env.CI,
        },
        {
            command: 'pnpm --filter @edu-lanka/api run start',
            env: { PORT: '8081' },
            url: 'http://localhost:8081/api/v1/health',
            reuseExistingServer: !process.env.CI,
        }
    ],
});
