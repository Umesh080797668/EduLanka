import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    PayloadTooLargeException,
} from '@nestjs/common';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { randomUUID } from 'crypto';
import { SupabaseService, assertUuid } from '../supabase/supabase.service';
import { assertCleanContent } from '../../common/utils/profanity-filter';
import type { CreateBlogDto } from './dto/create-blog.dto';
import { BlogScope } from './dto/create-blog.dto';
import type { UpdateBlogDto } from './dto/update-blog.dto';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { ReactionDto } from './dto/reaction.dto';
import type { ModerateCommentDto } from './dto/moderate-comment.dto';

@Injectable()
export class BlogService {
    private readonly logger = new Logger(BlogService.name);

    constructor(private readonly supabase: SupabaseService) { }

    private async isCallerGrowthOrAbove(caller: JwtPayload): Promise<boolean> {
        if (caller.role === UserRole.SUPER_ADMIN) return true;
        let plan = caller.tenantPlan;
        if (!plan && caller.tenantId) {
            try {
                const { data: tenant } = await this.supabase.adminClient
                    .from('tenants')
                    ?.select('plan')
                    ?.eq('id', caller.tenantId)
                    ?.maybeSingle() ?? {};
                plan = tenant?.plan as any;
            } catch {
                plan = undefined;
            }
        }
        return plan === 'GROWTH' || plan === 'INSTITUTIONAL';
    }

    private async getTeacherClassIds(caller: JwtPayload): Promise<string[]> {
        const { data: tRec } = await this.supabase.adminClient
            .from('teachers')
            .select('id')
            .eq('tenant_id', caller.tenantId)
            .eq('user_id', caller.sub)
            .maybeSingle();

        if (!tRec?.id) return [];

        const { data: ctRows } = await this.supabase.adminClient
            .from('class_teachers')
            .select('class_id')
            .eq('tenant_id', caller.tenantId)
            .eq('teacher_id', tRec.id);

        return (ctRows ?? []).map((ct: any) => ct.class_id).filter(Boolean);
    }

    private async getStudentClassId(caller: JwtPayload): Promise<string | null> {
        const { data: sRec } = await this.supabase.adminClient
            .from('students')
            .select('class_id')
            .eq('tenant_id', caller.tenantId)
            .eq('user_id', caller.sub)
            .maybeSingle();

        return sRec?.class_id ?? null;
    }

    private async getUserDisplayName(userId: string): Promise<string> {
        const { data } = await this.supabase.adminClient
            .from('users')
            .select('full_name')
            .eq('id', userId)
            .maybeSingle();
        return data?.full_name || 'Academic Educator';
    }

    private async emitSyncEvent(
        tenantId: string | null,
        entityType: 'blog_post' | 'blog_comment' | 'blog_reaction',
        entityId: string,
        eventType: string,
        payload: Record<string, any>,
        isPlatformScope = false,
    ) {
        if (isPlatformScope) {
            try {
                // Broadcast across all active Growth+ tenants so nationwide students get offline updates
                const { data: activeTenants } = await this.supabase.adminClient
                    .from('tenants')
                    .select('id, plan')
                    .eq('status', 'ACTIVE');

                for (const t of (activeTenants ?? [])) {
                    if (t.plan === 'GROWTH' || t.plan === 'INSTITUTIONAL') {
                        try {
                            await this.supabase.adminClient.rpc('append_sync_event', {
                                p_tenant_id: t.id,
                                p_entity_type: entityType,
                                p_entity_id: entityId,
                                p_event_type: eventType,
                                p_payload: payload,
                                p_client_uuid: randomUUID(),
                            });
                        } catch (tErr: any) {
                            this.logger.warn(`Failed to broadcast platform sync event to tenant ${t.id}: ${tErr?.message}`);
                        }
                    }
                }
            } catch (err: any) {
                this.logger.warn(`Failed to broadcast platform sync events: ${err?.message}`);
            }
            return;
        }

        if (!tenantId) return;

        try {
            await this.supabase.adminClient.rpc('append_sync_event', {
                p_tenant_id: tenantId,
                p_entity_type: entityType,
                p_entity_id: entityId,
                p_event_type: eventType,
                p_payload: payload,
                p_client_uuid: randomUUID(),
            });
        } catch (err: any) {
            this.logger.warn(`Failed to emit sync event for ${entityType}: ${err?.message}`);
        }
    }

    /**
     * Lists educational blogs with 3-tier scoping (Class, School, Platform).
     */
    async listBlogs(
        caller: JwtPayload,
        options: { scope?: BlogScope; classId?: string; tag?: string; search?: string },
    ) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        const client = this.supabase.adminClient;
        let query = client
            .from('blogs')
            .select('*, classes(id, name, grade)')
            .is('deleted_at', null)
            .eq('is_published', true)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (options.scope) {
            query = query.eq('scope', options.scope);
        }

        if (options.tag) {
            query = query.contains('tags', [options.tag]);
        }

        if (options.search) {
            query = query.ilike('title', `%${options.search}%`);
        }

        const { data, error } = await query;
        if (error) {
            this.logger.error(`Failed to list blogs: ${error.message}`);
            return [];
        }

        const rows = data ?? [];

        // Scoping filter & Plan Gating
        const isGrowth = await this.isCallerGrowthOrAbove(caller);
        if (options.scope === BlogScope.PLATFORM && !isGrowth) {
            throw new ForbiddenException('Platform-wide educational blogs require a Growth or Institutional plan');
        }

        let teacherClasses: string[] = [];
        let studentClass: string | null = null;
        if (caller.role === UserRole.TEACHER) {
            teacherClasses = await this.getTeacherClassIds(caller);
        } else if (caller.role === UserRole.STUDENT) {
            studentClass = await this.getStudentClassId(caller);
        }

        const filtered = rows.filter((b: any) => {
            if (caller.role === UserRole.SUPER_ADMIN) return true;
            if (b.scope === BlogScope.PLATFORM) return isGrowth;
            if (b.tenant_id !== caller.tenantId) return false;
            if (b.scope === BlogScope.SCHOOL) return true;
            if (b.scope === BlogScope.CLASS) {
                if (caller.role === UserRole.SCHOOL_ADMIN) return true;
                if (caller.role === UserRole.TEACHER) {
                    return b.class_id && teacherClasses.includes(b.class_id);
                }
                if (caller.role === UserRole.STUDENT) {
                    return b.class_id && studentClass === b.class_id;
                }
                return false;
            }
            return false;
        });

        // Attach user's reaction if any
        if (filtered.length > 0) {
            const blogIds = filtered.map((b: any) => b.id);
            const { data: reactions } = await client
                .from('blog_reactions')
                .select('blog_id, reaction_type')
                .eq('user_id', caller.sub)
                .in('blog_id', blogIds);

            const reactionMap = new Map((reactions ?? []).map((r: any) => [r.blog_id, r.reaction_type]));
            return filtered.map((b: any) => ({
                ...b,
                myReaction: reactionMap.get(b.id) ?? null,
            }));
        }

        return filtered;
    }

    /**
     * Gets blog post detail along with threaded comments and user reactions.
     */
    async getBlogById(id: string, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(id, 'id');

        const client = this.supabase.adminClient;
        const { data: blog, error: blogErr } = await client
            .from('blogs')
            .select('*, classes(id, name, grade)')
            .eq('id', id)
            .is('deleted_at', null)
            .maybeSingle();

        if (blogErr || !blog) {
            throw new NotFoundException(`Educational blog ${id} not found`);
        }

        // Check scoping & plan access
        if (blog.scope === BlogScope.PLATFORM) {
            const isGrowth = await this.isCallerGrowthOrAbove(caller);
            if (!isGrowth) {
                throw new ForbiddenException('Platform-wide educational blogs require a Growth or Institutional plan');
            }
        } else if (caller.role !== UserRole.SUPER_ADMIN) {
            if (blog.tenant_id !== caller.tenantId) {
                throw new ForbiddenException('Cannot access blog from another school');
            }
            if (blog.scope === BlogScope.CLASS) {
                if (caller.role === UserRole.TEACHER) {
                    const classes = await this.getTeacherClassIds(caller);
                    if (!classes.includes(blog.class_id)) {
                        throw new ForbiddenException('Teacher not assigned to this class');
                    }
                } else if (caller.role === UserRole.STUDENT) {
                    const classId = await this.getStudentClassId(caller);
                    if (classId !== blog.class_id) {
                        throw new ForbiddenException('Student not enrolled in this class');
                    }
                }
            }
        }

        // Fetch comments and build threaded tree
        const { data: comments } = await client
            .from('blog_comments')
            .select('*')
            .eq('blog_id', id)
            .is('deleted_at', null)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: true });

        // Fetch reactions on blog and comments
        const { data: userReactions } = await client
            .from('blog_reactions')
            .select('*')
            .eq('user_id', caller.sub)
            .or(`blog_id.eq.${id},comment_id.in.(${(comments ?? []).map((c: any) => c.id).join(',') || '00000000-0000-0000-0000-000000000000'})`);

        const myBlogReaction = (userReactions ?? []).find((r: any) => r.blog_id === id)?.reaction_type ?? null;
        const myCommentReactions = new Map(
            (userReactions ?? []).filter((r: any) => r.comment_id).map((r: any) => [r.comment_id, r.reaction_type]),
        );

        // Build comment tree (top-level comments with replies)
        const commentList = (comments ?? []).map((c: any) => ({
            ...c,
            myReaction: myCommentReactions.get(c.id) ?? null,
            replies: [] as any[],
        }));

        const commentMap = new Map<string, any>(commentList.map((c) => [c.id, c]));
        const rootComments: any[] = [];

        for (const c of commentList) {
            if (c.parent_id && commentMap.has(c.parent_id)) {
                commentMap.get(c.parent_id).replies.push(c);
            } else {
                rootComments.push(c);
            }
        }

        return {
            ...blog,
            myReaction: myBlogReaction,
            comments: rootComments,
        };
    }

    /**
     * Composes a new educational blog.
     * Restricted to Teachers, School Admins, and Super Admins.
     */
    async createBlog(dto: CreateBlogDto, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        assertCleanContent(dto.title, 'Blog title');
        assertCleanContent(dto.contentMarkdown, 'Blog content');

        if (caller.role !== UserRole.TEACHER && caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only teachers and administrators can author educational blogs');
        }

        if (dto.scope === BlogScope.PLATFORM) {
            const isGrowth = await this.isCallerGrowthOrAbove(caller);
            if (!isGrowth) {
                throw new ForbiddenException('Platform-wide educational blogs require a Growth or Institutional plan');
            }

            if (caller.role === UserRole.TEACHER) {
                // Check if teacher is vetted as master teacher
                const { data: teacher } = await this.supabase.adminClient
                    .from('teachers')
                    .select('is_master_teacher')
                    .eq('user_id', caller.sub)
                    .eq('tenant_id', caller.tenantId)
                    .eq('is_active', true)
                    .maybeSingle();

                if (!teacher?.is_master_teacher) {
                    throw new ForbiddenException('Only vetted master teachers and Super Admins can publish platform-wide blogs');
                }
            } else if (caller.role !== UserRole.SUPER_ADMIN) {
                throw new ForbiddenException('Only vetted master teachers and Super Admins can publish platform-wide blogs');
            }
        }

        if (dto.scope === BlogScope.CLASS) {
            if (!dto.classId) {
                throw new BadRequestException('classId is required for class-scoped blogs');
            }
            assertUuid(dto.classId, 'classId');
            if (caller.role === UserRole.TEACHER) {
                const teacherClasses = await this.getTeacherClassIds(caller);
                if (!teacherClasses.includes(dto.classId)) {
                    throw new ForbiddenException('Teachers can only author blogs for their assigned classes');
                }
            }
        }

        if (dto.attachments && dto.attachments.length > 0) {
            const { data: usage } = await this.supabase.adminClient
                .from('tenant_storage_usage')
                .select('is_quota_exceeded, storage_quota_gb')
                .eq('tenant_id', caller.tenantId)
                .maybeSingle();

            if (usage?.is_quota_exceeded) {
                throw new PayloadTooLargeException(
                    `Tenant storage quota of ${usage.storage_quota_gb} GB exceeded. Upgrade plan to attach media to blogs.`,
                );
            }
        }

        const authorName = await this.getUserDisplayName(caller.sub);
        const tenantId = dto.scope === BlogScope.PLATFORM ? null : caller.tenantId;

        const { data, error } = await this.supabase.adminClient
            .from('blogs')
            .insert({
                tenant_id: tenantId,
                class_id: dto.scope === BlogScope.CLASS ? dto.classId : null,
                scope: dto.scope,
                author_id: caller.sub,
                author_name: authorName,
                author_role: caller.role,
                title: dto.title,
                content_markdown: dto.contentMarkdown,
                cover_image_url: dto.coverImageUrl,
                attachments: dto.attachments ?? [],
                tags: dto.tags ?? [],
                is_published: dto.isPublished ?? true,
                is_pinned: dto.isPinned ?? false,
            })
            .select()
            .single();

        if (error || !data) {
            this.logger.error(`Failed to create blog: ${error?.message}`);
            throw new BadRequestException('Failed to create educational blog');
        }

        // Emit sync event for mobile sync (fanned out across active tenants if platform-wide)
        const isPlatform = data.scope === BlogScope.PLATFORM;
        await this.emitSyncEvent(caller.tenantId, 'blog_post', data.id, 'CREATED', data, isPlatform);

        return data;
    }

    /**
     * Updates an educational blog.
     */
    async updateBlog(id: string, dto: UpdateBlogDto, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(id, 'id');

        if (dto.title !== undefined) {
            assertCleanContent(dto.title, 'Blog title');
        }
        if (dto.contentMarkdown !== undefined) {
            assertCleanContent(dto.contentMarkdown, 'Blog content');
        }

        const { data: blog, error: fetchErr } = await this.supabase.adminClient
            .from('blogs')
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .maybeSingle();

        if (fetchErr || !blog) {
            throw new NotFoundException(`Educational blog ${id} not found`);
        }

        if (caller.role !== UserRole.SUPER_ADMIN) {
            if (caller.role === UserRole.SCHOOL_ADMIN) {
                if (!blog.tenant_id || blog.tenant_id !== caller.tenantId || blog.scope === BlogScope.PLATFORM) {
                    throw new ForbiddenException('School Admins can only update blogs belonging to their school');
                }
            } else if (caller.role === UserRole.TEACHER) {
                if (blog.author_id !== caller.sub) {
                    throw new ForbiddenException('You can only update blogs you authored');
                }
                if (blog.scope !== BlogScope.PLATFORM && blog.tenant_id !== caller.tenantId) {
                    throw new ForbiddenException('Cannot update blogs from another school');
                }
            } else {
                throw new ForbiddenException('You do not have permission to update this blog');
            }
        }

        const updatePayload: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        if (dto.title !== undefined) updatePayload.title = dto.title;
        if (dto.contentMarkdown !== undefined) updatePayload.content_markdown = dto.contentMarkdown;
        if (dto.attachments !== undefined) {
            if (dto.attachments.length > 0) {
                const { data: usage } = await this.supabase.adminClient
                    .from('tenant_storage_usage')
                    .select('is_quota_exceeded, storage_quota_gb')
                    .eq('tenant_id', caller.tenantId)
                    .maybeSingle();

                if (usage?.is_quota_exceeded) {
                    throw new PayloadTooLargeException(
                        `Tenant storage quota of ${usage.storage_quota_gb} GB exceeded. Upgrade plan to attach media to blogs.`,
                    );
                }
            }
            updatePayload.attachments = dto.attachments;
        }
        if (dto.isPublished !== undefined) updatePayload.is_published = dto.isPublished;
        if (dto.isPinned !== undefined) updatePayload.is_pinned = dto.isPinned;

        const { data, error } = await this.supabase.adminClient
            .from('blogs')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new BadRequestException(`Failed to update blog: ${error?.message}`);
        }

        const isPlatform = blog.scope === BlogScope.PLATFORM;
        await this.emitSyncEvent(caller.tenantId, 'blog_post', data.id, 'UPDATED', data, isPlatform);

        return data;
    }

    /**
     * Soft-deletes an educational blog.
     */
    async deleteBlog(id: string, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(id, 'id');

        const { data: blog } = await this.supabase.adminClient
            .from('blogs')
            .select('id, author_id, tenant_id, scope')
            .eq('id', id)
            .is('deleted_at', null)
            .maybeSingle();

        if (!blog) {
            throw new NotFoundException(`Educational blog ${id} not found`);
        }

        if (caller.role !== UserRole.SUPER_ADMIN) {
            if (caller.role === UserRole.SCHOOL_ADMIN) {
                if (!blog.tenant_id || blog.tenant_id !== caller.tenantId || blog.scope === BlogScope.PLATFORM) {
                    throw new ForbiddenException('School Admins can only delete blogs belonging to their school');
                }
            } else if (caller.role === UserRole.TEACHER) {
                if (blog.author_id !== caller.sub) {
                    throw new ForbiddenException('You can only delete blogs you authored');
                }
                if (blog.scope !== BlogScope.PLATFORM && blog.tenant_id !== caller.tenantId) {
                    throw new ForbiddenException('Cannot delete blogs from another school');
                }
            } else {
                throw new ForbiddenException('You do not have permission to delete this blog');
            }
        }

        await this.supabase.adminClient
            .from('blogs')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        const isPlatform = blog.scope === BlogScope.PLATFORM;
        await this.emitSyncEvent(caller.tenantId, 'blog_post', id, 'DELETED', { id }, isPlatform);

        return { success: true };
    }

    /**
     * Adds a comment or nested reply to a blog post.
     * Both teachers and students can participate in discourse.
     */
    async createComment(blogId: string, dto: CreateCommentDto, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(blogId, 'blogId');

        assertCleanContent(dto.content, 'Comment');

        // Verify blog exists and is active
        const { data: blog } = await this.supabase.adminClient
            .from('blogs')
            .select('id, tenant_id, scope')
            .eq('id', blogId)
            .is('deleted_at', null)
            .maybeSingle();

        if (!blog) {
            throw new NotFoundException(`Educational blog ${blogId} not found`);
        }

        if (dto.parentId) {
            assertUuid(dto.parentId, 'parentId');
            const { data: parent } = await this.supabase.adminClient
                .from('blog_comments')
                .select('id, blog_id, parent_id')
                .eq('id', dto.parentId)
                .is('deleted_at', null)
                .maybeSingle();

            if (!parent || parent.blog_id !== blogId) {
                throw new BadRequestException('Parent comment does not exist on this blog post');
            }

            if (parent.parent_id !== null) {
                throw new BadRequestException('Threaded replies cannot exceed a maximum nesting depth of 2 levels');
            }
        }

        const authorName = await this.getUserDisplayName(caller.sub);

        const { data, error } = await this.supabase.adminClient
            .from('blog_comments')
            .insert({
                tenant_id: caller.tenantId,
                blog_id: blogId,
                parent_id: dto.parentId ?? null,
                author_id: caller.sub,
                author_name: authorName,
                author_role: caller.role,
                content: dto.content,
            })
            .select()
            .single();

        if (error || !data) {
            this.logger.error(`Failed to post comment: ${error?.message}`);
            throw new BadRequestException('Failed to post comment');
        }

        // Increment comments_count on blog
        const { count } = await this.supabase.adminClient
            .from('blog_comments')
            .select('*', { count: 'exact', head: true })
            .eq('blog_id', blogId)
            .is('deleted_at', null);

        await this.supabase.adminClient
            .from('blogs')
            .update({ comments_count: count ?? 1 })
            .eq('id', blogId);

        const isPlatform = blog.scope === BlogScope.PLATFORM;
        await this.emitSyncEvent(caller.tenantId, 'blog_comment', data.id, 'CREATED', data, isPlatform);

        return data;
    }

    /**
     * Moderates a comment (hide off-topic comments or pin insightful answers).
     */
    async moderateComment(commentId: string, dto: ModerateCommentDto, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(commentId, 'commentId');

        if (caller.role !== UserRole.TEACHER && caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only teachers and administrators can moderate comments');
        }

        const { data: comment, error: fetchErr } = await this.supabase.adminClient
            .from('blog_comments')
            .select('id, blog_id, author_id, tenant_id, is_pinned, is_hidden, blogs!inner(id, author_id, tenant_id, scope, class_id)')
            .eq('id', commentId)
            .is('deleted_at', null)
            .maybeSingle();

        if (fetchErr || !comment) {
            throw new NotFoundException(`Blog comment ${commentId} not found`);
        }

        const blog = (comment as any).blogs;

        if (caller.role !== UserRole.SUPER_ADMIN) {
            const isBlogAuthor = blog.author_id === caller.sub;
            const isSchoolAdminForTenant = caller.role === UserRole.SCHOOL_ADMIN && blog.tenant_id === caller.tenantId;

            let isClassTeacher = false;
            if (caller.role === UserRole.TEACHER && blog.scope === BlogScope.CLASS && blog.class_id && blog.tenant_id === caller.tenantId) {
                const teacherClasses = await this.getTeacherClassIds(caller);
                isClassTeacher = teacherClasses.includes(blog.class_id);
            }

            if (!isBlogAuthor && !isSchoolAdminForTenant && !isClassTeacher) {
                throw new ForbiddenException('Only the authoring teacher and School Admins can moderate comments');
            }
        }

        const updatePayload: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        if (dto.isHidden !== undefined) updatePayload.is_hidden = dto.isHidden;
        if (dto.isPinned !== undefined) updatePayload.is_pinned = dto.isPinned;

        const { data, error } = await this.supabase.adminClient
            .from('blog_comments')
            .update(updatePayload)
            .eq('id', commentId)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Blog comment ${commentId} not found`);
        }

        const isPlatform = blog?.scope === BlogScope.PLATFORM;
        await this.emitSyncEvent(caller.tenantId, 'blog_comment', data.id, 'MODERATED', data, isPlatform);

        return data;
    }

    /**
     * Deletes a comment.
     */
    async deleteComment(commentId: string, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(commentId, 'commentId');

        const { data: comment, error: fetchErr } = await this.supabase.adminClient
            .from('blog_comments')
            .select('id, blog_id, author_id, tenant_id, blogs!inner(id, author_id, tenant_id, scope, class_id)')
            .eq('id', commentId)
            .is('deleted_at', null)
            .maybeSingle();

        if (fetchErr || !comment) {
            throw new NotFoundException(`Comment ${commentId} not found`);
        }

        const blog = (comment as any).blogs;

        if (caller.role !== UserRole.SUPER_ADMIN) {
            const isCommentAuthor = comment.author_id === caller.sub;
            const isBlogAuthor = blog.author_id === caller.sub;
            const isSchoolAdminForTenant = caller.role === UserRole.SCHOOL_ADMIN && blog.tenant_id === caller.tenantId;

            let isClassTeacher = false;
            if (caller.role === UserRole.TEACHER && blog.scope === BlogScope.CLASS && blog.class_id && blog.tenant_id === caller.tenantId) {
                const teacherClasses = await this.getTeacherClassIds(caller);
                isClassTeacher = teacherClasses.includes(blog.class_id);
            }

            if (!isCommentAuthor && !isBlogAuthor && !isSchoolAdminForTenant && !isClassTeacher) {
                throw new ForbiddenException('You do not have permission to delete this comment');
            }
        }

        await this.supabase.adminClient
            .from('blog_comments')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', commentId);

        // Update comment count on blog
        const { count } = await this.supabase.adminClient
            .from('blog_comments')
            .select('*', { count: 'exact', head: true })
            .eq('blog_id', comment.blog_id)
            .is('deleted_at', null);

        await this.supabase.adminClient
            .from('blogs')
            .update({ comments_count: count ?? 0 })
            .eq('id', comment.blog_id);

        const isPlatform = blog?.scope === BlogScope.PLATFORM;
        await this.emitSyncEvent(caller.tenantId, 'blog_comment', commentId, 'DELETED', { id: commentId, blogId: comment.blog_id }, isPlatform);

        return { success: true };
    }

    /**
     * Toggles an academic reaction on a blog post or comment.
     */
    async toggleReaction(blogId: string, dto: ReactionDto, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(blogId, 'blogId');

        const client = this.supabase.adminClient;
        let isPlatform = false;
        try {
            const { data: blogRec } = await client.from('blogs')?.select('scope')?.eq('id', blogId)?.maybeSingle() ?? {};
            isPlatform = blogRec?.scope === BlogScope.PLATFORM;
        } catch {
            isPlatform = false;
        }

        let query = client
            .from('blog_reactions')
            .select('id, reaction_type')
            .eq('user_id', caller.sub);

        if (dto.commentId) {
            assertUuid(dto.commentId, 'commentId');
            query = query.eq('comment_id', dto.commentId);
        } else {
            query = query.eq('blog_id', blogId);
        }

        const { data: existing } = await query.maybeSingle();

        if (existing) {
            // If clicking the same reaction, remove it (toggle off)
            await client.from('blog_reactions').delete().eq('id', existing.id);

            const newCount = await this.updateReactionCount(blogId, dto.commentId);
            await this.emitSyncEvent(caller.tenantId, 'blog_reaction', existing.id, 'REMOVED', {
                blogId,
                commentId: dto.commentId,
                userId: caller.sub,
            }, isPlatform);

            return { active: false, reactionType: null, totalLikes: newCount };
        } else {
            // Insert reaction
            const { data, error } = await client
                .from('blog_reactions')
                .insert({
                    tenant_id: caller.tenantId,
                    blog_id: dto.commentId ? null : blogId,
                    comment_id: dto.commentId ?? null,
                    user_id: caller.sub,
                    reaction_type: dto.reactionType,
                })
                .select()
                .single();

            if (error || !data) {
                throw new BadRequestException('Failed to add reaction');
            }

            const newCount = await this.updateReactionCount(blogId, dto.commentId);
            await this.emitSyncEvent(caller.tenantId, 'blog_reaction', data.id, 'ADDED', data, isPlatform);

            return { active: true, reactionType: dto.reactionType, totalLikes: newCount };
        }
    }

    private async updateReactionCount(blogId: string, commentId?: string): Promise<number> {
        const client = this.supabase.adminClient;
        if (commentId) {
            const { count } = await client
                .from('blog_reactions')
                .select('*', { count: 'exact', head: true })
                .eq('comment_id', commentId);
            await client.from('blog_comments').update({ likes_count: count ?? 0 }).eq('id', commentId);
            return count ?? 0;
        } else {
            const { count } = await client
                .from('blog_reactions')
                .select('*', { count: 'exact', head: true })
                .eq('blog_id', blogId);
            await client.from('blogs').update({ likes_count: count ?? 0 }).eq('id', blogId);
            return count ?? 0;
        }
    }
}
