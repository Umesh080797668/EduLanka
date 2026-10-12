import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { ForbiddenException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../../supabase/supabase.service';
import { PaperHubService } from '../paper-hub.service';

describe('PaperHubService', () => {
    let service: PaperHubService;
    let mockSupabase: any;
    let mockAdminClient: any;

    const tenantA = '11111111-1111-1111-1111-111111111111';
    const tenantB = '22222222-2222-2222-2222-222222222222';
    const paperUuid1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const paperUuid2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    const teacherTenantA: JwtPayload = {
        sub: '33333333-3333-3333-3333-333333333333',
        tenantId: tenantA,
        email: 'teacher@tenanta.lk',
        role: UserRole.TEACHER,
    };

    const studentTenantB: JwtPayload = {
        sub: '44444444-4444-4444-4444-444444444444',
        tenantId: tenantB,
        email: 'student@tenantb.lk',
        role: UserRole.STUDENT,
    };

    const superAdmin: JwtPayload = {
        sub: '55555555-5555-5555-5555-555555555555',
        tenantId: tenantA,
        email: 'admin@edulanka.lk',
        role: UserRole.SUPER_ADMIN,
    };

    beforeEach(async () => {
        mockAdminClient = {
            from: jest.fn().mockImplementation((_table: string) => {
                const builder: any = {
                    select: jest.fn().mockReturnThis(),
                    or: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    range: jest.fn().mockResolvedValue({
                        data: [
                            {
                                id: paperUuid1,
                                tenant_id: null, // National paper
                                title: 'G.C.E. O/L Mathematics 2025',
                                subject: 'Mathematics',
                                grade_level: 11,
                                exam_year: 2025,
                                exam_type: 'GCE_OL',
                                medium: 'sinhala',
                                paper_url: 'https://res.cloudinary.com/demo/raw/upload/ol_math_2025.pdf',
                                marking_scheme_url: 'https://res.cloudinary.com/demo/raw/upload/ol_math_2025_ms.pdf',
                                is_paired: true,
                            },
                        ],
                        count: 1,
                        error: null,
                    }),
                    maybeSingle: jest.fn().mockImplementation(() => {
                        return Promise.resolve({
                            data: {
                                id: paperUuid1,
                                tenant_id: tenantA, // Owned by Tenant A
                                title: 'Grade 11 Term 1 Mathematics',
                                subject: 'Mathematics',
                                grade_level: 11,
                                exam_year: 2026,
                                exam_type: 'TERM_TEST',
                                medium: 'english',
                                paper_url: 'https://res.cloudinary.com/demo/raw/upload/term1.pdf',
                                marking_scheme_url: null,
                                is_paired: false,
                            },
                            error: null,
                        });
                    }),
                    insert: jest.fn().mockImplementation((payload: any) => {
                        const isArray = Array.isArray(payload);
                        const data = isArray
                            ? payload.map((p: any, idx: number) => ({ id: `paper-${idx}`, ...p, is_paired: Boolean(p.marking_scheme_url) }))
                            : { id: paperUuid2, ...payload, is_paired: Boolean(payload.marking_scheme_url) };
                        const b: any = {
                            select: jest.fn().mockImplementation(() => {
                                if (isArray) return Promise.resolve({ data, error: null });
                                return {
                                    single: jest.fn().mockResolvedValue({ data, error: null }),
                                };
                            }),
                        };
                        return b;
                    }),
                    update: jest.fn().mockImplementation((payload: any) => ({
                        eq: jest.fn().mockReturnValue({
                            select: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: {
                                        id: paperUuid1,
                                        tenant_id: tenantA,
                                        title: 'Grade 11 Term 1 Mathematics',
                                        ...payload,
                                        is_paired: Boolean(payload.marking_scheme_url),
                                    },
                                    error: null,
                                }),
                            }),
                        }),
                    })),
                };
                return builder;
            }),
        };

        mockSupabase = {
            adminClient: mockAdminClient,
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaperHubService,
                { provide: SupabaseService, useValue: mockSupabase },
            ],
        }).compile();

        service = module.get<PaperHubService>(PaperHubService);
    });

    it('should list past papers accessible to tenant', async () => {
        const result = await service.listPapers(teacherTenantA, { page: 1, limit: 10 });
        expect(result.data.length).toBe(1);
        expect(result.total).toBe(1);
    });

    it('should allow user of the same tenant to access school paper', async () => {
        const paper = await service.getPaperById(teacherTenantA, paperUuid1);
        expect(paper.id).toBe(paperUuid1);
        expect(paper.tenant_id).toBe(tenantA);
    });

    it('should block user from another tenant accessing school paper with ForbiddenException', async () => {
        await expect(
            service.getPaperById(studentTenantB, paperUuid1),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Super Admin to access any school paper', async () => {
        const paper = await service.getPaperById(superAdmin, paperUuid1);
        expect(paper.id).toBe(paperUuid1);
    });

    it('should create a school paper with teacher attribution', async () => {
        const result = await service.createPaper(teacherTenantA, {
            title: 'Grade 10 Science Midterm',
            subject: 'Science',
            gradeLevel: 10,
            examYear: 2026,
            examType: 'TERM_TEST',
            medium: 'sinhala',
            paperCloudinaryId: 'sci_10_paper',
            paperUrl: 'https://res.cloudinary.com/demo/raw/upload/sci10.pdf',
        });

        expect(result.success).toBe(true);
        expect(result.paper.title).toBe('Grade 10 Science Midterm');
    });

    it('should bulk upload national papers with tenant_id null', async () => {
        const result = await service.bulkUploadNationalPapers(superAdmin, [
            {
                title: 'G.C.E. A/L Combined Mathematics 2025',
                subject: 'Combined Mathematics',
                gradeLevel: 13,
                examYear: 2025,
                examType: 'AL',
                medium: 'english',
                paperCloudinaryId: 'al_math_2025',
                paperUrl: 'https://res.cloudinary.com/demo/raw/upload/al_math.pdf',
            },
        ]);

        expect(result.success).toBe(true);
        expect(result.count).toBe(1);
    });

    it('should attach a marking scheme to an existing paper', async () => {
        const result = await service.attachMarkingScheme(teacherTenantA, paperUuid1, {
            markingSchemeCloudinaryId: 'ms_cloud_id_1',
            markingSchemeUrl: 'https://res.cloudinary.com/demo/raw/upload/ms.pdf',
        });

        expect(result.success).toBe(true);
        expect(result.paper.marking_scheme_url).toBeTruthy();
        expect(result.paper.is_paired).toBe(true);
    });

    it('should reject non-super-admin from modifying national paper marking scheme', async () => {
        mockAdminClient.from = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: {
                    id: paperUuid1,
                    tenant_id: null, // National paper
                    title: 'National G.C.E. O/L History',
                },
                error: null,
            }),
        });

        await expect(
            service.attachMarkingScheme(teacherTenantA, paperUuid1, {
                markingSchemeCloudinaryId: 'ms_history',
                markingSchemeUrl: 'https://res.cloudinary.com/demo/raw/upload/history_ms.pdf',
            }),
        ).rejects.toThrow(ForbiddenException);
    });
});
