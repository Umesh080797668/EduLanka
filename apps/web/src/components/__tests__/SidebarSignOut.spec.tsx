import { authManager } from '@/lib/auth-store';

// Mock routing and next-intl before importing Sidebar
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

jest.mock('@/i18n/routing', () => ({
    Link: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/',
}));

jest.mock('next/navigation', () => ({
    usePathname: () => '/',
    useRouter: () => ({ push: jest.fn() }),
}));

import { getLoginRedirectUrl, performClientLogout } from '../layout/Sidebar';

describe('Sidebar Sign-Out & Locale Logic', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        // Clear document cookies
        Object.defineProperty(document, 'cookie', {
            writable: true,
            value: 'token=active-token; refreshToken=active-refresh',
        });
        jest.spyOn(authManager, 'clearAuth').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('getLoginRedirectUrl', () => {
        it('preserves the user locale in the login redirect for Sinhala', () => {
            expect(getLoginRedirectUrl('/si/teacher/classes')).toBe('/si/login');
        });

        it('preserves the user locale in the login redirect for Tamil', () => {
            expect(getLoginRedirectUrl('/ta/student/dashboard')).toBe('/ta/login');
        });

        it('preserves the user locale in the login redirect for English', () => {
            expect(getLoginRedirectUrl('/en/institution-admin/notices')).toBe('/en/login');
        });

        it('defaults to English locale when pathname has no valid locale prefix', () => {
            expect(getLoginRedirectUrl('/unknown/dashboard')).toBe('/en/login');
            expect(getLoginRedirectUrl('')).toBe('/en/login');
        });
    });

    describe('performClientLogout', () => {
        it('clears auth store and cookies upon sign-out', () => {
            performClientLogout('/en/institution-admin');

            expect(authManager.clearAuth).toHaveBeenCalledTimes(1);
            expect(document.cookie).toContain('Max-Age=0');
        });
    });
});
