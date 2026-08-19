class AuthManager {
    private token: string = '';
    private tenantId: string = '';
    private role: string = '';
    private userId: string = '';

    setAuth(token: string, tenantId: string, role: string, userId: string) {
        this.token = token;
        this.tenantId = tenantId;
        this.role = role;
        this.userId = userId;
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
    }
}
export const authManager = new AuthManager();
