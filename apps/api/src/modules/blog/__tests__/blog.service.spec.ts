import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { ForbiddenException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { SupabaseService } from '../../supabase/supabase.service';
import { BlogService } from '../blog.service';
import { BlogScope } from '../dto/create-blog.dto';
import { ReactionType } from '../dto/reaction.dto';

describe('BlogService', () => {
    let service: BlogService;
    let mockSupabase: any;

    const tenantUuid = '11111111-1111-1111-1111-111111111111';
    const teacherUuid = '22222222-2222-2222-2222-222222222222';
    const studentUuid = '33333333-3333-3333-3333-333333333333';
    const classUuid = '44444444-4444-4444-4444-444444444444';
    const blogUuid = '55555555-5555-5555-5555-555555555555';
    const commentUuid = '66666666-6666-6666-6666-666666666666';

    const teacherCaller: JwtPayload = {
        sub: teacherUuid,
        tenantId: tenantUuid,
        email: 'teacher@school.lk',
        role: UserRole.TEACHER,
    };

    const studentCaller: JwtPayload = {
        sub: studentUuid,
        tenantId: tenantUuid,
        email: 'student@school.lk',
        role: UserRole.STUDENT,
    };

    beforeEach(async () => {
        mockSupabase = {
            adminClient: {
                from: jest.fn(),
                rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BlogService,
                { provide: SupabaseService, useValue: mockSupabase },
            ],
        }).compile();

        service = module.get<BlogService>(BlogService);
    });

    describe('createBlog', () => {
        it('should strictly reject students from authoring top-level blogs', async () => {
            await expect(
                service.createBlog(
                    {
                        title: 'Student Blog Attempt',
                        contentMarkdown: 'Hello',
                        scope: BlogScope.SCHOOL,
                    },
                    studentCaller,
                ),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should reject teacher authoring class blog for an unassigned class', async () => {
            mockSupabase.adminClient.from.mockImplementation((table: string) => {
                if (table === 'teachers') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'teacher-rec-1' } }),
                    };
                }
                if (table === 'class_teachers') {
                    const chain: any = {};
                    chain.select = jest.fn().mockReturnValue(chain);
                    chain.eq = jest.fn().mockImplementation(() => chain);
                    chain.then = (resolve: any) => resolve({ data: [{ class_id: 'other-class' }] });
                    return chain;
                }
                return { select: jest.fn().mockReturnThis() };
            });

            await expect(
                service.createBlog(
                    {
                        title: 'Grade 10 Mathematics',
                        contentMarkdown: 'Class content',
                        scope: BlogScope.CLASS,
                        classId: classUuid,
                    },
                    teacherCaller,
                ),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should allow teacher to author class blog for assigned class', async () => {
            mockSupabase.adminClient.from.mockImplementation((table: string) => {
                if (table === 'teachers') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'teacher-rec-1' } }),
                    };
                }
                if (table === 'class_teachers') {
                    const chain: any = {};
                    chain.select = jest.fn().mockReturnValue(chain);
                    chain.eq = jest.fn().mockImplementation(() => chain);
                    chain.then = (resolve: any) => resolve({ data: [{ class_id: classUuid }] });
                    return chain;
                }
                if (table === 'users') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({ data: { full_name: 'Kamal Perera' } }),
                    };
                }
                if (table === 'blogs') {
                    return {
                        insert: jest.fn().mockReturnThis(),
                        select: jest.fn().mockReturnThis(),
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: blogUuid,
                                title: 'Grade 10 Quadratic Equations',
                                scope: 'CLASS',
                                class_id: classUuid,
                                author_id: teacherUuid,
                            },
                            error: null,
                        }),
                    };
                }
                return { select: jest.fn().mockReturnThis() };
            });

            const blog = await service.createBlog(
                {
                    title: 'Grade 10 Quadratic Equations',
                    contentMarkdown: 'Let us solve ax^2 + bx + c = 0',
                    scope: BlogScope.CLASS,
                    classId: classUuid,
                },
                teacherCaller,
            );

            expect(blog.id).toBe(blogUuid);
            expect(blog.scope).toBe('CLASS');
            expect(mockSupabase.adminClient.rpc).toHaveBeenCalledWith(
                'append_sync_event',
                expect.objectContaining({
                    p_entity_type: 'blog_post',
                    p_event_type: 'CREATED',
                }),
            );
        });
    });

    describe('createComment & discourse', () => {
        it('should allow student to comment on an active blog post', async () => {
            mockSupabase.adminClient.from.mockImplementation((table: string) => {
                if (table === 'blogs') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        is: jest.fn().mockReturnThis(),
                        update: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: { id: blogUuid, tenant_id: tenantUuid },
                        }),
                    };
                }
                if (table === 'users') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({ data: { full_name: 'Sunil Silva' } }),
                    };
                }
                if (table === 'blog_comments') {
                    return {
                        insert: jest.fn().mockReturnThis(),
                        select: jest.fn().mockImplementation((_cols?: string, opts?: any) => {
                            if (opts?.count === 'exact') {
                                return { eq: jest.fn().mockReturnThis(), is: jest.fn().mockResolvedValue({ count: 1 }) };
                            }
                            return {
                                single: jest.fn().mockResolvedValue({
                                    data: {
                                        id: commentUuid,
                                        blog_id: blogUuid,
                                        author_id: studentUuid,
                                        content: 'Could you explain step 3?',
                                    },
                                    error: null,
                                }),
                            };
                        }),
                    };
                }
                return { select: jest.fn().mockReturnThis() };
            });

            const comment = await service.createComment(
                blogUuid,
                { content: 'Could you explain step 3?' },
                studentCaller,
            );

            expect(comment.id).toBe(commentUuid);
            expect(comment.author_id).toBe(studentUuid);
        });

        it('should reject unvetted teacher from creating platform-wide blog', async () => {
            mockSupabase.adminClient.from.mockImplementation((table: string) => {
                if (table === 'teachers') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: { is_master_teacher: false },
                        }),
                    };
                }
                return { select: jest.fn().mockReturnThis() };
            });

            await expect(
                service.createBlog(
                    {
                        title: 'National Curriculum Guide',
                        contentMarkdown: 'Physics guide',
                        scope: BlogScope.PLATFORM,
                    },
                    teacherCaller,
                ),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should allow vetted master teacher to create platform-wide blog', async () => {
            mockSupabase.adminClient.from.mockImplementation((table: string) => {
                if (table === 'teachers') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: { is_master_teacher: true },
                        }),
                    };
                }
                if (table === 'users') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: { full_name: 'Master Teacher Perera' },
                        }),
                    };
                }
                if (table === 'blogs') {
                    return {
                        insert: jest.fn().mockReturnThis(),
                        select: jest.fn().mockReturnThis(),
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: blogUuid,
                                title: 'National Curriculum Guide',
                                scope: 'PLATFORM',
                                author_id: teacherUuid,
                            },
                            error: null,
                        }),
                    };
                }
                return { select: jest.fn().mockReturnThis() };
            });

            const blog = await service.createBlog(
                {
                    title: 'National Curriculum Guide',
                    contentMarkdown: 'Physics guide',
                    scope: BlogScope.PLATFORM,
                },
                teacherCaller,
            );

            expect(blog.scope).toBe('PLATFORM');
        });
    });

    describe('updateBlog', () => {
        it('should reject school admin from updating another school blog (IDOR)', async () => {
            const adminCaller: JwtPayload = {
                sub: '77777777-7777-7777-7777-777777777777',
                tenantId: tenantUuid,
                email: 'admin@school1.lk',
                role: UserRole.SCHOOL_ADMIN,
            };

            mockSupabase.adminClient.from.mockImplementation((table: string) => {
                if (table === 'blogs') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        is: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: {
                                id: blogUuid,
                                tenant_id: 'other-school-uuid',
                                author_id: 'other-teacher',
                                scope: 'SCHOOL',
                            },
                            error: null,
                        }),
                    };
                }
                return { select: jest.fn().mockReturnThis() };
            });

            await expect(
                service.updateBlog(blogUuid, { title: 'Hacked Title' }, adminCaller),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should reject school admin from updating platform-wide blog', async () => {
            const adminCaller: JwtPayload = {
                sub: '77777777-7777-7777-7777-777777777777',
                tenantId: tenantUuid,
                email: 'admin@school1.lk',
                role: UserRole.SCHOOL_ADMIN,
            };

            mockSupabase.adminClient.from.mockImplementation((table: string) => {
                if (table === 'blogs') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        is: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: {
                                id: blogUuid,
                                tenant_id: null,
                                author_id: 'master-teacher',
                                scope: 'PLATFORM',
                            },
                            error: null,
                        }),
                    };
                }
                return { select: jest.fn().mockReturnThis() };
            });

            await expect(
                service.updateBlog(blogUuid, { title: 'Hacked Platform Title' }, adminCaller),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('comments and moderation', () => {
        it('should allow authoring teacher to moderate comment', async () => {
            mockSupabase.adminClient.from.mockImplementation((table: string) => {
                if (table === 'blog_comments') {
                    const chain: any = {};
                    chain.select = jest.fn().mockReturnThis();
                    chain.eq = jest.fn().mockReturnThis();
                    chain.is = jest.fn().mockReturnThis();
                    chain.maybeSingle = jest.fn().mockResolvedValue({
                        data: {
                            id: commentUuid,
                            blog_id: blogUuid,
                            author_id: studentUuid,
                            tenant_id: tenantUuid,
                            is_pinned: false,
                            is_hidden: false,
                            blogs: {
                                id: blogUuid,
                                author_id: teacherUuid, // author is teacherCaller
                                tenant_id: tenantUuid,
                                scope: 'SCHOOL',
                            },
                        },
                        error: null,
                    });
                    chain.update = jest.fn().mockReturnThis();
                    chain.single = jest.fn().mockResolvedValue({
                        data: { id: commentUuid, is_pinned: true },
                        error: null,
                    });
                    return chain;
                }
                return { select: jest.fn().mockReturnThis() };
            });

            const moderated = await service.moderateComment(
                commentUuid,
                { isPinned: true },
                teacherCaller,
            );

            expect(moderated.is_pinned).toBe(true);
        });

        it('should reject teacher from moderating comments on another teacher blog (IDOR)', async () => {
            mockSupabase.adminClient.from.mockImplementation((table: string) => {
                if (table === 'blog_comments') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        is: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: {
                                id: commentUuid,
                                blog_id: blogUuid,
                                author_id: studentUuid,
                                tenant_id: tenantUuid,
                                blogs: {
                                    id: blogUuid,
                                    author_id: 'different-teacher-uuid',
                                    tenant_id: tenantUuid,
                                    scope: 'SCHOOL',
                                },
                            },
                            error: null,
                        }),
                    };
                }
                return { select: jest.fn().mockReturnThis() };
            });

            await expect(
                service.moderateComment(commentUuid, { isPinned: true }, teacherCaller),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should reject unauthorized teacher from deleting another teacher comment (IDOR)', async () => {
            mockSupabase.adminClient.from.mockImplementation((table: string) => {
                if (table === 'blog_comments') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        is: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: {
                                id: commentUuid,
                                blog_id: blogUuid,
                                author_id: 'original-author-uuid',
                                tenant_id: tenantUuid,
                                blogs: {
                                    id: blogUuid,
                                    author_id: 'different-teacher-uuid',
                                    tenant_id: tenantUuid,
                                    scope: 'SCHOOL',
                                },
                            },
                            error: null,
                        }),
                    };
                }
                return { select: jest.fn().mockReturnThis() };
            });

            await expect(
                service.deleteComment(commentUuid, teacherCaller),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should reject student from moderating comments', async () => {
            await expect(
                service.moderateComment(commentUuid, { isPinned: true }, studentCaller),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('toggleReaction', () => {
        it('should add reaction when none exists', async () => {
            mockSupabase.adminClient.from.mockImplementation((table: string) => {
                if (table === 'blog_reactions') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({ data: null }),
                        insert: jest.fn().mockReturnThis(),
                        single: jest.fn().mockResolvedValue({
                            data: { id: 'reaction-1', reaction_type: 'HELPFUL' },
                            error: null,
                        }),
                    };
                }
                if (table === 'blogs') {
                    return {
                        update: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                    };
                }
                return { select: jest.fn().mockReturnThis() };
            });

            const result = await service.toggleReaction(
                blogUuid,
                { reactionType: ReactionType.HELPFUL },
                studentCaller,
            );

            expect(result.active).toBe(true);
            expect(result.reactionType).toBe('HELPFUL');
        });
    });
});
