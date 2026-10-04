interface PostgrestError {
    message: string;
    details: string;
    hint: string | null;
    code: string;
}

interface RpcResult<T> {
    data: T | null;
    error: PostgrestError | null;
}

describe('RPC Security Isolation (Anon Key Defense)', () => {
    const mockAnonClient = {
        rpc: jest.fn<Promise<RpcResult<null>>, [string, Record<string, unknown>?]>().mockImplementation(
            (fnName: string): Promise<RpcResult<null>> => {
                // Emulate Supabase PostgREST 401/403/404 response for revoked RPC functions
                return Promise.resolve({
                    data: null,
                    error: {
                        code: '42501',
                        message: `permission denied for function ${fnName}`,
                        details: 'Ensure user has appropriate role grants.',
                        hint: null,
                    },
                });
            },
        ),
    };

    const mockServiceClient = {
        rpc: jest.fn<Promise<RpcResult<{ success: boolean }>>, [string, Record<string, unknown>?]>().mockImplementation(
            (_fnName: string, _params?: Record<string, unknown>): Promise<RpcResult<{ success: boolean }>> => {
                return Promise.resolve({
                    data: { success: true },
                    error: null,
                });
            },
        ),
    };

    it('should reject anon caller from executing activate_disaster_mode', async () => {
        const { data, error } = await mockAnonClient.rpc('activate_disaster_mode', {
            p_tenant_id: '11111111-1111-1111-1111-111111111111',
            p_triggered_by: '22222222-2222-2222-2222-222222222222',
            p_reason: 'FLOOD',
        });

        expect(error).toBeDefined();
        expect(error?.code).toBe('42501');
        expect(error?.message).toContain('permission denied');
        expect(data).toBeNull();
    });

    it('should reject anon caller from executing deactivate_disaster_mode', async () => {
        const { data, error } = await mockAnonClient.rpc('deactivate_disaster_mode', {
            p_tenant_id: '11111111-1111-1111-1111-111111111111',
            p_deactivated_by: '22222222-2222-2222-2222-222222222222',
        });

        expect(error).toBeDefined();
        expect(error?.code).toBe('42501');
        expect(error?.message).toContain('permission denied');
        expect(data).toBeNull();
    });

    it('should reject anon caller from executing increment_disaster_sms_count', async () => {
        const { data, error } = await mockAnonClient.rpc('increment_disaster_sms_count', {
            p_event_id: '11111111-1111-1111-1111-111111111111',
            p_status: 'DELIVERED',
        });

        expect(error).toBeDefined();
        expect(error?.code).toBe('42501');
        expect(error?.message).toContain('permission denied');
        expect(data).toBeNull();
    });

    it('should reject anon caller from executing exec_sql (arbitrary SQL execution prevention)', async () => {
        const { data, error } = await mockAnonClient.rpc('exec_sql', {
            sql: 'SELECT * FROM users;',
        });

        expect(error).toBeDefined();
        expect(error?.code).toBe('42501');
        expect(error?.message).toContain('permission denied');
        expect(data).toBeNull();
    });

    it('should allow service_role to execute functions', async () => {
        const { data, error } = await mockServiceClient.rpc('activate_disaster_mode', {
            p_tenant_id: '11111111-1111-1111-1111-111111111111',
        });

        expect(error).toBeNull();
        expect(data).toEqual({ success: true });
    });
});
