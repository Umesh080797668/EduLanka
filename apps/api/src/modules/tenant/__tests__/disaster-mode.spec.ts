import type { JwtPayload } from '@edu-lanka/shared-types';
import { DisasterReason, TenantPlan, UserRole } from '@edu-lanka/shared-types';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { TenantService } from '../tenant.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { SmsService } from '../../sms/sms.service';

describe('Disaster Mode (TenantService)', () => {
    let service: TenantService;
    let mockSupabase: any;
    let mockAuditLogs: any;
    let mockSmsService: any;

    const schoolAdminCaller: JwtPayload = {
        sub: 'admin-user-id',
        tenantId: 'tenant-uuid-1',
        role: UserRole.SCHOOL_ADMIN,
        email: 'principal@school.lk',
    };

    const teacherCaller: JwtPayload = {
        sub: 'teacher-user-id',
        tenantId: 'tenant-uuid-1',
        role: UserRole.TEACHER,
        email: 'teacher@school.lk',
    };

    beforeEach(async () => {
        mockAuditLogs = {
            logAction: jest.fn().mockResolvedValue({ id: 'audit-log-id' }),
        };

        mockSmsService = {
            sendBatchSms: jest.fn().mockResolvedValue({ queuedCount: 2 }),
        };

        mockSupabase = {
            adminClient: {
                from: jest.fn().mockImplementation((table: string) => {
                    if (table === 'tenants') {
                        return {
                            select: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({
                                        data: {
                                            id: 'tenant-uuid-1',
                                            name: 'Central College',
                                            plan: TenantPlan.STARTER,
                                            disaster_mode: false,
                                        },
                                        error: null,
                                    }),
                                }),
                            }),
                        };
                    }
                    if (table === 'disaster_events') {
                        return {
                            select: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    order: jest.fn().mockResolvedValue({
                                        data: [
                                            {
                                                id: 'event-uuid-1',
                                                reason: 'FLOOD',
                                                is_active: false,
                                                activated_at: '2026-10-01T08:00:00Z',
                                            },
                                        ],
                                        error: null,
                                    }),
                                }),
                            }),
                            update: jest.fn().mockReturnValue({
                                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                            }),
                        };
                    }
                    return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() };
                }),
                rpc: jest.fn().mockImplementation((fn: string) => {
                    if (fn === 'activate_disaster_mode') {
                        return Promise.resolve({
                            data: { id: 'event-uuid-new', is_active: true },
                            error: null,
                        });
                    }
                    if (fn === 'deactivate_disaster_mode') {
                        return Promise.resolve({
                            data: { id: 'event-uuid-new', is_active: false },
                            error: null,
                        });
                    }
                    return Promise.resolve({ data: null, error: null });
                }),
            },
            getTenantClient: jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            not: jest.fn().mockResolvedValue({
                                data: [
                                    { phone_number: '+94771234567' },
                                    { phone_number: '+94779876543' },
                                ],
                                error: null,
                            }),
                        }),
                    }),
                }),
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TenantService,
                { provide: SupabaseService, useValue: mockSupabase },
                { provide: AuditLogsService, useValue: mockAuditLogs },
                { provide: SmsService, useValue: mockSmsService },
            ],
        }).compile();

        service = module.get<TenantService>(TenantService);
    });

    describe('activateDisasterMode', () => {
        it('should forbid non-administrators from activating Disaster Mode', async () => {
            await expect(
                service.activateDisasterMode(
                    { reason: DisasterReason.FLOOD },
                    teacherCaller
                )
            ).rejects.toThrow(ForbiddenException);
        });

        it('should atomically call activate_disaster_mode RPC and enqueue SMS with friendly text', async () => {
            const result = await service.activateDisasterMode(
                {
                    reason: DisasterReason.FLOOD,
                    details: 'Severe localized flooding',
                    resumeDate: '2026-10-10',
                },
                schoolAdminCaller
            );

            expect(mockSupabase.adminClient.rpc).toHaveBeenCalledWith('activate_disaster_mode', {
                p_tenant_id: 'tenant-uuid-1',
                p_triggered_by: 'admin-user-id',
                p_reason: 'FLOOD',
                p_details: 'Severe localized flooding',
                p_resume_date: expect.any(String),
            });

            expect(mockSmsService.sendBatchSms).toHaveBeenCalledWith(
                ['+94771234567', '+94779876543'],
                expect.stringContaining('Flood conditions'),
                'tenant-uuid-1',
                expect.objectContaining({
                    disasterEventId: 'event-uuid-new',
                    bypassQuota: true,
                    isSafetyCritical: true,
                })
            );

            expect(mockAuditLogs.logAction).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'DISASTER_MODE_ENGAGED',
                    tenantId: 'tenant-uuid-1',
                })
            );

            expect(result).toEqual({
                active: true,
                eventId: 'event-uuid-new',
                smsQueued: 2,
            });
        });

        it('should dispatch localized Sinhala SMS when language is SI', async () => {
            await service.activateDisasterMode(
                {
                    reason: DisasterReason.FLOOD,
                    resumeDate: '2026-10-10',
                    language: 'SI',
                },
                schoolAdminCaller
            );

            expect(mockSmsService.sendBatchSms).toHaveBeenCalledWith(
                expect.any(Array),
                expect.stringContaining('[හදිසි නිවේදනය]'),
                'tenant-uuid-1',
                expect.any(Object)
            );
            expect(mockSmsService.sendBatchSms).toHaveBeenCalledWith(
                expect.any(Array),
                expect.stringContaining('ගංවතුර තත්ත්වය'),
                'tenant-uuid-1',
                expect.any(Object)
            );
        });

        it('should dispatch localized Tamil SMS when language is TA', async () => {
            await service.activateDisasterMode(
                {
                    reason: DisasterReason.CYCLONE,
                    resumeDate: '2026-10-10',
                    language: 'TA',
                },
                schoolAdminCaller
            );

            expect(mockSmsService.sendBatchSms).toHaveBeenCalledWith(
                expect.any(Array),
                expect.stringContaining('[அவசர அறிவிப்பு]'),
                'tenant-uuid-1',
                expect.any(Object)
            );
            expect(mockSmsService.sendBatchSms).toHaveBeenCalledWith(
                expect.any(Array),
                expect.stringContaining('சூறாவளி எச்சரிக்கை'),
                'tenant-uuid-1',
                expect.any(Object)
            );
        });

        it('should throw ConflictException 409 when disaster mode is already active', async () => {
            mockSupabase.adminClient.rpc.mockResolvedValueOnce({
                data: null,
                error: { code: '23505', message: 'DISASTER_ALREADY_ACTIVE' },
            });

            await expect(
                service.activateDisasterMode(
                    { reason: DisasterReason.CYCLONE },
                    schoolAdminCaller
                )
            ).rejects.toThrow(new ConflictException('Disaster Mode is already active for this school.'));
        });

        it('should suppress SMS dispatch for COMMUNITY tier schools per blueprint', async () => {
            mockSupabase.adminClient.from.mockImplementationOnce(() => ({
                select: () => ({
                    eq: () => ({
                        single: () =>
                            Promise.resolve({
                                data: {
                                    id: 'tenant-uuid-1',
                                    name: 'Community School',
                                    plan: TenantPlan.COMMUNITY,
                                    disaster_mode: false,
                                },
                                error: null,
                            }),
                    }),
                }),
            }));

            const result = await service.activateDisasterMode(
                { reason: DisasterReason.OTHER },
                schoolAdminCaller
            );

            expect(mockSmsService.sendBatchSms).not.toHaveBeenCalled();
            expect(result.smsQueued).toBe(0);
            expect(mockAuditLogs.logAction).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'DISASTER_MODE_ENGAGED' })
            );
        });
    });

    describe('deactivateDisasterMode', () => {
        it('should call deactivate_disaster_mode RPC and audit log disengagement', async () => {
            const result = await service.deactivateDisasterMode({}, schoolAdminCaller);

            expect(mockSupabase.adminClient.rpc).toHaveBeenCalledWith('deactivate_disaster_mode', {
                p_tenant_id: 'tenant-uuid-1',
                p_deactivated_by: 'admin-user-id',
                p_note: null,
            });

            expect(mockAuditLogs.logAction).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'DISASTER_MODE_DISENGAGED',
                    tenantId: 'tenant-uuid-1',
                })
            );

            expect(result).toEqual({ active: false });
        });

        it('should throw ConflictException if disaster mode is not currently active', async () => {
            mockSupabase.adminClient.rpc.mockResolvedValueOnce({
                data: null,
                error: { message: 'DISASTER_NOT_ACTIVE' },
            });

            await expect(
                service.deactivateDisasterMode({}, schoolAdminCaller)
            ).rejects.toThrow(new ConflictException('Disaster Mode is not currently active for this school.'));
        });
    });

    describe('getDisasterHistory', () => {
        it('should return chronological list of historical disaster events', async () => {
            const history = await service.getDisasterHistory(schoolAdminCaller.tenantId);
            expect(history).toHaveLength(1);
            expect(history[0].id).toBe('event-uuid-1');
        });
    });
});
