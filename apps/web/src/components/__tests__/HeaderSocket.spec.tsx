import { attemptTokenRefresh } from '@/lib/api-client';
import { authManager } from '@/lib/auth-store';

jest.mock('@/lib/api-client', () => ({
    apiClient: {
        get: jest.fn(),
    },
    attemptTokenRefresh: jest.fn(),
}));

jest.mock('@/lib/auth-store', () => ({
    authManager: {
        getToken: jest.fn(),
        getRole: jest.fn(() => 'TEACHER'),
        getTenantId: jest.fn(() => 'tenant-123'),
        getUserId: jest.fn(() => 'user-123'),
        clearAuth: jest.fn(),
    },
}));

describe('Notifications Socket Token & Backoff Handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('retrieves token via attemptTokenRefresh after full page reload when memory store is empty', async () => {
        // Full page reload state: token is not in memory
        (authManager.getToken as jest.Mock).mockReturnValue(null);
        (attemptTokenRefresh as jest.Mock).mockResolvedValue('refreshed-cookie-token');

        // Simulating the Header socket auth callback logic
        const authCallback = (cb: (data: object) => void) => {
            const currentToken = authManager.getToken();
            if (currentToken) {
                cb({ token: currentToken });
            } else {
                void attemptTokenRefresh()
                    .then((refreshed) => cb({ token: refreshed || '' }))
                    .catch(() => cb({ token: '' }));
            }
        };

        const callbackFn = jest.fn();
        authCallback(callbackFn);

        expect(attemptTokenRefresh).toHaveBeenCalledTimes(1);

        await Promise.resolve(); // flush microtasks
        expect(callbackFn).toHaveBeenCalledWith({ token: 'refreshed-cookie-token' });
    });

    it('uses memory token directly without calling attemptTokenRefresh when already in memory', () => {
        (authManager.getToken as jest.Mock).mockReturnValue('active-memory-token');

        const authCallback = (cb: (data: object) => void) => {
            const currentToken = authManager.getToken();
            if (currentToken) {
                cb({ token: currentToken });
            } else {
                void attemptTokenRefresh()
                    .then((refreshed) => cb({ token: refreshed || '' }))
                    .catch(() => cb({ token: '' }));
            }
        };

        const callbackFn = jest.fn();
        authCallback(callbackFn);

        expect(attemptTokenRefresh).not.toHaveBeenCalled();
        expect(callbackFn).toHaveBeenCalledWith({ token: 'active-memory-token' });
    });

    it('throttles token refresh with exponential backoff on consecutive connect_error events', () => {
        let refreshAttempts = 0;
        let refreshTimeoutId: any = null;
        const baseDelay = 1000;
        const maxDelay = 30000;

        const onConnectError = () => {
            if (refreshTimeoutId) return;
            const delay = Math.min(baseDelay * Math.pow(2, refreshAttempts), maxDelay);
            refreshAttempts++;

            refreshTimeoutId = setTimeout(() => {
                refreshTimeoutId = null;
                void attemptTokenRefresh();
            }, delay);
        };

        // Fire 10 consecutive connect_error events in rapid succession (simulating network outage retry loop)
        for (let i = 0; i < 10; i++) {
            onConnectError();
        }

        // Only 1 timeout should be scheduled, no refresh called yet
        expect(attemptTokenRefresh).not.toHaveBeenCalled();

        // Advance 1 second (1000ms base delay)
        jest.advanceTimersByTime(1000);

        // First backoff fires
        expect(attemptTokenRefresh).toHaveBeenCalledTimes(1);

        // Next error event scheduled at 2000ms delay
        onConnectError();
        jest.advanceTimersByTime(1000);
        expect(attemptTokenRefresh).toHaveBeenCalledTimes(1); // not yet 2000ms

        jest.advanceTimersByTime(1000);
        expect(attemptTokenRefresh).toHaveBeenCalledTimes(2); // 2000ms elapsed
    });
});
