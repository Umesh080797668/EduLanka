class AuthManager {
    private token: string = '';
    private tenantId: string = '';
    private role: string = '';
    private userId: string = '';
    private plan: string = '';

    constructor() {
        if (typeof window !== 'undefined') {
            this.tenantId = localStorage.getItem('tenantId') || '';
            this.role = localStorage.getItem('role') || '';
            this.userId = localStorage.getItem('userId') || '';
            this.plan = localStorage.getItem('tenantPlan') || '';
        }
    }

    setAuth(token: string, tenantId: string, role: string, userId: string, plan?: string) {
        this.token = token;
        this.tenantId = tenantId;
        this.role = role;
        this.userId = userId;
        if (plan) this.plan = plan;

        if (typeof window !== 'undefined') {
            localStorage.setItem('tenantId', tenantId);
            localStorage.setItem('role', role);
            localStorage.setItem('userId', userId);
            if (plan) localStorage.setItem('tenantPlan', plan);
            localStorage.setItem('isAuthenticated', 'true');
        }
    }

    setToken(token: string) {
        this.token = token;
    }

    setPlan(plan: string) {
        this.plan = plan;
        if (typeof window !== 'undefined') {
            localStorage.setItem('tenantPlan', plan);
        }
    }

    getToken(): string { return this.token; }
    getTenantId(): string { return this.tenantId; }
    getRole(): string { return this.role; }
    getUserId(): string { return this.userId; }
    getPlan(): string {
        return this.plan || (typeof window !== 'undefined' ? localStorage.getItem('tenantPlan') || 'COMMUNITY' : 'COMMUNITY');
    }

    clearAuth() {
        this.token = '';
        this.tenantId = '';
        this.role = '';
        this.userId = '';
        this.plan = '';

        if (typeof window !== 'undefined') {
            localStorage.removeItem('tenantId');
            localStorage.removeItem('role');
            localStorage.removeItem('userId');
            localStorage.removeItem('tenantPlan');
            localStorage.removeItem('isAuthenticated');
        }
    }
}
export const authManager = new AuthManager();
