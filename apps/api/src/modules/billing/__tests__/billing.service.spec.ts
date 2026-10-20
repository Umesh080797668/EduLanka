import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BillingService } from '../billing.service';
import { calculateActiveStudentFee } from '../billing.types';
import { SupabaseService } from '../../supabase/supabase.service';

describe('BillingService & Volume Discounts', () => {
    describe('calculateActiveStudentFee', () => {
        it('should give 0% discount for <= 250 students', () => {
            const res1 = calculateActiveStudentFee(100, 20);
            expect(res1.discountPercent).toBe(0);
            expect(res1.effectiveRatePerStudentLkr).toBe(20);
            expect(res1.totalStudentFeeLkr).toBe(2000);

            const res2 = calculateActiveStudentFee(250, 20);
            expect(res2.discountPercent).toBe(0);
            expect(res2.effectiveRatePerStudentLkr).toBe(20);
            expect(res2.totalStudentFeeLkr).toBe(5000);
        });

        it('should give 10% discount for 251 to 1,000 students', () => {
            const res1 = calculateActiveStudentFee(251, 20);
            expect(res1.discountPercent).toBe(10);
            expect(res1.effectiveRatePerStudentLkr).toBe(18);
            expect(res1.totalStudentFeeLkr).toBe(Math.round(251 * 18));

            const res2 = calculateActiveStudentFee(1000, 40);
            expect(res2.discountPercent).toBe(10);
            expect(res2.effectiveRatePerStudentLkr).toBe(36);
            expect(res2.totalStudentFeeLkr).toBe(36000);
        });

        it('should give 20% discount for 1,001 to 3,000 students', () => {
            const res1 = calculateActiveStudentFee(1001, 20);
            expect(res1.discountPercent).toBe(20);
            expect(res1.effectiveRatePerStudentLkr).toBe(16);
            expect(res1.totalStudentFeeLkr).toBe(Math.round(1001 * 16));
            expect(res1.isCustomQuote).toBe(false);

            const res2 = calculateActiveStudentFee(3000, 60);
            expect(res2.discountPercent).toBe(20);
            expect(res2.effectiveRatePerStudentLkr).toBe(48);
            expect(res2.totalStudentFeeLkr).toBe(144000);
            expect(res2.isCustomQuote).toBe(false);
        });

        it('should flag custom quote required for 3,000+ students (§7c)', () => {
            const res = calculateActiveStudentFee(3500, 50);
            expect(res.isCustomQuote).toBe(true);
            expect(res.discountPercent).toBe(20);
            expect(res.tierDescription).toContain('Custom Quote');
            expect(res.effectiveRatePerStudentLkr).toBe(40);
            expect(res.totalStudentFeeLkr).toBe(3500 * 40);

            // Supports custom negotiated discount percentage
            const customRes = calculateActiveStudentFee(4000, 50, 30);
            expect(customRes.isCustomQuote).toBe(true);
            expect(customRes.discountPercent).toBe(30);
            expect(customRes.effectiveRatePerStudentLkr).toBe(35);
            expect(customRes.totalStudentFeeLkr).toBe(4000 * 35);
        });
    });

    describe('Unpaid Invoice Policy (Grace Period)', () => {
        let service: BillingService;
        let mockSupabase: any;

        beforeEach(async () => {
            mockSupabase = {
                adminClient: {
                    from: jest.fn(),
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    BillingService,
                    { provide: SupabaseService, useValue: mockSupabase },
                    { provide: ConfigService, useValue: { get: jest.fn() } },
                ],
            }).compile();

            service = module.get<BillingService>(BillingService);
        });

        it('should report account in good standing if no overdue invoices', async () => {
            mockSupabase.adminClient.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        in: jest.fn().mockReturnValue({
                            order: jest.fn().mockResolvedValue({ data: [] }),
                        }),
                    }),
                }),
            });

            const status = await service.checkTenantInvoiceStatus('tenant-1');
            expect(status.hasOverdueInvoices).toBe(false);
            expect(status.isAccountLocked).toBe(false);
        });

        it('should grant 14-day grace period for recently overdue invoices', async () => {
            const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago
            mockSupabase.adminClient.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        in: jest.fn().mockReturnValue({
                            order: jest.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: 'inv-1',
                                        total_amount_lkr: 15000,
                                        status: 'OVERDUE',
                                        created_at: recentDate,
                                    },
                                ],
                            }),
                        }),
                    }),
                }),
            });

            const status = await service.checkTenantInvoiceStatus('tenant-1');
            expect(status.hasOverdueInvoices).toBe(true);
            expect(status.inGracePeriod).toBe(true);
            expect(status.isAccountLocked).toBe(false);
            expect(status.graceDaysRemaining).toBeGreaterThan(0);
        });

        it('should lock account if invoice is overdue past 14-day grace period', async () => {
            const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(); // 20 days ago
            mockSupabase.adminClient.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        in: jest.fn().mockReturnValue({
                            order: jest.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: 'inv-2',
                                        total_amount_lkr: 25000,
                                        status: 'OVERDUE',
                                        created_at: oldDate,
                                    },
                                ],
                            }),
                        }),
                    }),
                }),
            });

            const status = await service.checkTenantInvoiceStatus('tenant-1');
            expect(status.hasOverdueInvoices).toBe(true);
            expect(status.inGracePeriod).toBe(false);
            expect(status.isAccountLocked).toBe(true);
            expect(status.graceDaysRemaining).toBe(0);
        });
    });

    describe('Invoice Lifecycle & Safe Upsert', () => {
        let service: BillingService;
        let mockSupabase: any;

        beforeEach(async () => {
            mockSupabase = {
                adminClient: {
                    from: jest.fn(),
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    BillingService,
                    { provide: SupabaseService, useValue: mockSupabase },
                    { provide: ConfigService, useValue: { get: jest.fn() } },
                ],
            }).compile();

            service = module.get<BillingService>(BillingService);
        });

        it('should issue a DRAFT invoice to ISSUED', async () => {
            mockSupabase.adminClient.from.mockImplementation(() => ({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: { id: 'inv-1', status: 'DRAFT', tenant_id: 't-1', billing_month: '2026-10' },
                        }),
                    }),
                }),
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            select: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: { id: 'inv-1', status: 'ISSUED' },
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                }),
            }));

            const issued = await service.issueInvoice('inv-1');
            expect(issued.status).toBe('ISSUED');
        });

        it('should mark an invoice as PAID', async () => {
            mockSupabase.adminClient.from.mockImplementation(() => ({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: { id: 'inv-1', status: 'ISSUED', tenant_id: 't-1' },
                        }),
                    }),
                }),
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        select: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({
                                data: { id: 'inv-1', status: 'PAID' },
                                error: null,
                            }),
                        }),
                    }),
                }),
            }));

            const paid = await service.markInvoicePaid('inv-1');
            expect(paid.status).toBe('PAID');
        });

        it('should transition issued invoices older than 14 days to OVERDUE', async () => {
            mockSupabase.adminClient.from.mockImplementation(() => ({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        lt: jest.fn().mockResolvedValue({
                            data: [{ id: 'inv-old', tenant_id: 't-1', total_amount_lkr: 5000 }],
                            error: null,
                        }),
                    }),
                }),
                update: jest.fn().mockReturnValue({
                    in: jest.fn().mockResolvedValue({ error: null }),
                }),
            }));

            const count = await service.processOverdueInvoices();
            expect(count).toBe(1);
        });
    });
});

