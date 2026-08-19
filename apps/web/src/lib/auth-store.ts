class AuthManager {
    private token: string = '';
    private tenantId: string = '';
    private role: string = '';
    private userId: string = '';

    constructor() {
        if (typeof window !== 'undefined') {
            this.tenantId = localStorage.getItem('tenantId') || '';
            this.role = localStorage.getItem('role') || '';
            this.userId = localStorage.getItem('userId') || '';
        }
    }

    setAuth(token: string, tenantId: string, role: string, userId: string) {
        this.token = token;
        this.tenantId = tenantId;
        this.role = role;
        this.userId = userId;

        if (typeof window !== 'undefined') {
            localStorage.setItem('tenantId', tenantId);
            localStorage.setItem('role', role);
            localStorage.setItem('userId', userId);
            localStorage.setItem('isAuthenticated', 'true');
        }
    }

    getToken(): string { return this.token; }
    getTenantId(): string { return this.tenantId; }
    getRole(): string { return this.role; }
    getUserId(): string { return this.userId; }

    clearAuth() {
        this.token = '';
        this.tenantId = '';
        this.role = '';
        this.userId = '';

        if (typeof window !== 'undefined') {
            localStorage.removeItem('tenantId');
            localStorage.removeItem('role');
            localStorage.removeItem('userId');
            localStorage.removeItem('isAuthenticated');
        }
    }
}
export const authManager = new AuthManager();
