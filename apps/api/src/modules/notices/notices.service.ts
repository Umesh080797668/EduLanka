import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { UserRole } from '@edu-lanka/shared-types';
import { SupabaseService } from '../supabase/supabase.service';
import { SmsService } from '../sms/sms.service';
import { sanitizeNoticeHtml, noticeHtmlToText } from '../../common/utils/sanitize-html';

@Injectable()
export class NoticesService {
    private readonly logger = new Logger(NoticesService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly smsService: SmsService
    ) { }

    async createNotice(tenantId: string, authorId: string, request: any, callerRole?: string) {
        const adminClient = this.supabaseService.adminClient;

        const { data: tenant } = await adminClient
            .from('tenants')
            .select('plan')
            .eq('id', tenantId)
            .single();

        if (!tenant) throw new ForbiddenException('Tenant not found');

        const { title, content_html, scope, target_grade, target_class_id, priority, attachments, expires_at, send_sms } = request;

        // Security check: Only SUPER_ADMIN can bypass SMS quotas
        if (request.bypass_quota && callerRole !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only System Administrators can bypass SMS quotas.');
        }

        // Security check: Teachers cannot create SCHOOL_WIDE/UNIVERSAL notices or send SMS
        if (callerRole === UserRole.TEACHER) {
            if (scope === 'SCHOOL_WIDE' || scope === 'UNIVERSAL') {
                throw new ForbiddenException('Teachers are not permitted to create school-wide notices.');
            }
            if (send_sms) {
                throw new ForbiddenException('Teachers are not permitted to trigger SMS notifications.');
            }
        }

        // Notice bodies are authored as HTML and rendered into every recipient's
        // browser, so anyone who can post could otherwise script a principal's
        // session. Scrub on write — the stored row is then safe for all readers.
        const safeContent = sanitizeNoticeHtml(content_html);
        if (!safeContent) {
            throw new BadRequestException('Notice content is required.');
        }

        // Blueprint constraints for Free tier
        if (tenant.plan === 'COMMUNITY') {
            if (scope !== 'SCHOOL_WIDE' && scope !== 'UNIVERSAL') {
                throw new ForbiddenException('Community tier only supports SCHOOL_WIDE scoping. Upgrade to Starter to unlock Class/Grade targeting.');
            }
            if (send_sms) {
                throw new ForbiddenException('SMS notifications are strictly unavailable for the Community tier.');
            }
        }

        const client = this.supabaseService.getTenantClient(tenantId);

        // If teacher creates class notice, verify teacher is assigned to that class
        if (callerRole === UserRole.TEACHER && scope === 'CLASS_SPECIFIC' && target_class_id) {
            const { data: teacher } = await client
                .from('teachers')
                .select('id')
                .eq('user_id', authorId)
                .maybeSingle();

            if (teacher?.id) {
                const { data: assignment } = await client
                    .from('class_teachers')
                    .select('id')
                    .eq('teacher_id', teacher.id)
                    .eq('class_id', target_class_id)
                    .maybeSingle();

                if (!assignment) {
                    throw new ForbiddenException('You are not assigned to teach this class.');
                }
            }
        }

        const { data, error } = await client
            .from('notices')
            .insert({
                tenant_id: tenantId,
                author_id: authorId,
                title,
                content_html: safeContent,
                scope,
                target_grade: target_grade ? parseInt(target_grade) : null,
                target_class_id: target_class_id || null,
                priority,
                attachments,
                expires_at: expires_at || null
            })
            .select()
            .single();

        if (error) {
            this.logger.error(`Error saving notice: ${error.message}`);
            throw error;
        }

        if (send_sms && tenant.plan !== 'COMMUNITY') {
            // System Admin overrides mapping (strictly verified above)
            const forceBypass = callerRole === UserRole.SUPER_ADMIN && request.bypass_quota === true;

            // Background Twilio broadcast via BullMQ Producer. Detached on
            // purpose — the notice is already saved and must not be rolled back
            // by a carrier or quota failure.
            void this.dispatchNoticeSms(tenantId, data, forceBypass);
        }

        return data;
    }

    /**
     * Fan a notice out over SMS to the guardians its scope targets using batch enqueuing.
     */
    private async dispatchNoticeSms(tenantId: string, notice: any, bypassQuota: boolean): Promise<void> {
        try {
            const recipients = await this.resolveSmsRecipients(tenantId, notice);
            if (recipients.length === 0) {
                this.logger.warn(`Notice ${notice.id} requested SMS but no guardian in scope has a number on file.`);
                return;
            }

            // Unicode-safe plain text — Twilio is configured for UTF-8 so Sinhala
            // and Tamil bodies survive the trip.
            const preview = noticeHtmlToText(notice.content_html).slice(0, 240);
            const body = `[EduLanka] ${notice.title}${preview ? ` — ${preview}` : ''}`;

            this.logger.log(`Dispatching batch of ${recipients.length} SMS for notice ${notice.id}`);
            await this.smsService.sendBatchSms(recipients, body, tenantId, {
                noticeId: notice.id,
                bypassQuota,
            });
        } catch (e: any) {
            this.logger.error(`SMS dispatcher failure for notice ${notice.id}: ${e.message}`);
        }
    }

    /** Guardian phone numbers for a notice's scope, de-duplicated. */
    private async resolveSmsRecipients(tenantId: string, notice: any): Promise<string[]> {
        const client = this.supabaseService.getTenantClient(tenantId);

        // UNIVERSAL and SCHOOL_WIDE reach every guardian on file.
        if (notice.scope !== 'GRADE_LEVEL' && notice.scope !== 'CLASS_SPECIFIC') {
            const { data } = await client
                .from('users')
                .select('phone_number')
                .eq('role', 'PARENT')
                .not('phone_number', 'is', null);
            return this.uniquePhones((data ?? []).map((u: any) => u.phone_number));
        }

        let classIds: string[] = [];
        if (notice.scope === 'CLASS_SPECIFIC') {
            if (!notice.target_class_id) return [];
            classIds = [notice.target_class_id];
        } else {
            if (notice.target_grade === null || notice.target_grade === undefined) return [];
            const { data: classes } = await client
                .from('classes')
                .select('id')
                .eq('grade', notice.target_grade);
            classIds = (classes ?? []).map((c: any) => c.id);
        }
        if (classIds.length === 0) return [];

        const { data: students } = await client
            .from('students')
            .select('id')
            .in('class_id', classIds);

        const studentIds = (students ?? []).map((s: any) => s.id);
        if (studentIds.length === 0) return [];

        const { data: guardians } = await client
            .from('parents')
            .select('users(phone_number)')
            .in('student_id', studentIds);

        return this.uniquePhones((guardians ?? []).map((g: any) => g.users?.phone_number));
    }

    private uniquePhones(values: (string | null | undefined)[]): string[] {
        return [
            ...new Set(
                values
                    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
                    .map((v) => v.trim()),
            ),
        ];
    }

    /**
     * Retrieve notices scoped to the caller's enrollment and permissions.
     * Prevents students/parents/teachers from querying arbitrary class/grade notices.
     * Defaults to school-wide + enrolled/assigned classes & grades when params are omitted.
     */
    async getNotices(tenantId: string, userId: string, userRole: string, classId?: string, gradeId?: string) {
        const client = this.supabaseService.getTenantClient(tenantId);
        const parsedGrade = gradeId ? parseInt(gradeId, 10) : undefined;

        let query = client.from('notices').select('*, author:users(full_name, role, avatar_url)');
        query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

        if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.SCHOOL_ADMIN) {
            // Admins have school-wide visibility; respect query filters if provided
            if (classId) {
                query = query.eq('target_class_id', classId).eq('scope', 'CLASS_SPECIFIC');
            } else if (parsedGrade !== undefined && !isNaN(parsedGrade)) {
                query = query.eq('target_grade', parsedGrade).eq('scope', 'GRADE_LEVEL');
            }
        } else if (userRole === UserRole.STUDENT) {
            const { data: student } = await client
                .from('students')
                .select('class_id, classes(grade)')
                .eq('user_id', userId)
                .maybeSingle();

            const enrolledClassId = student?.class_id;
            const enrolledGrade = (student as any)?.classes?.grade;

            if (classId) {
                if (!enrolledClassId || enrolledClassId !== classId) {
                    throw new ForbiddenException('You can only access notices for your enrolled class.');
                }
                query = query.eq('target_class_id', classId).eq('scope', 'CLASS_SPECIFIC');
            } else if (parsedGrade !== undefined && !isNaN(parsedGrade)) {
                if (enrolledGrade === undefined || enrolledGrade !== parsedGrade) {
                    throw new ForbiddenException('You can only access notices for your enrolled grade.');
                }
                query = query.eq('target_grade', parsedGrade).eq('scope', 'GRADE_LEVEL');
            } else {
                const conditions: string[] = ['scope.in.(SCHOOL_WIDE,UNIVERSAL)'];
                if (enrolledClassId) {
                    conditions.push(`and(scope.eq.CLASS_SPECIFIC,target_class_id.eq.${enrolledClassId})`);
                }
                if (enrolledGrade !== undefined && enrolledGrade !== null) {
                    conditions.push(`and(scope.eq.GRADE_LEVEL,target_grade.eq.${enrolledGrade})`);
                }
                if (conditions.length === 1) {
                    query = query.in('scope', ['SCHOOL_WIDE', 'UNIVERSAL']);
                } else {
                    query = query.or(conditions.join(','));
                }
            }
        } else if (userRole === UserRole.PARENT) {
            const { data: children } = await client
                .from('parents')
                .select('students(class_id, classes(grade))')
                .eq('user_id', userId);

            const childrenClassIds = new Set<string>();
            const childrenGrades = new Set<number>();

            for (const row of children ?? []) {
                const s = (row as any).students;
                if (s?.class_id) childrenClassIds.add(s.class_id);
                if (s?.classes?.grade !== undefined && s?.classes?.grade !== null) {
                    childrenGrades.add(s.classes.grade);
                }
            }

            if (classId) {
                if (!childrenClassIds.has(classId)) {
                    throw new ForbiddenException("You can only access notices for your children's classes.");
                }
                query = query.eq('target_class_id', classId).eq('scope', 'CLASS_SPECIFIC');
            } else if (parsedGrade !== undefined && !isNaN(parsedGrade)) {
                if (!childrenGrades.has(parsedGrade)) {
                    throw new ForbiddenException("You can only access notices for your children's grades.");
                }
                query = query.eq('target_grade', parsedGrade).eq('scope', 'GRADE_LEVEL');
            } else {
                const conditions: string[] = ['scope.in.(SCHOOL_WIDE,UNIVERSAL)'];
                if (childrenClassIds.size > 0) {
                    const classList = Array.from(childrenClassIds).join(',');
                    conditions.push(`and(scope.eq.CLASS_SPECIFIC,target_class_id.in.(${classList}))`);
                }
                if (childrenGrades.size > 0) {
                    const gradeList = Array.from(childrenGrades).join(',');
                    conditions.push(`and(scope.eq.GRADE_LEVEL,target_grade.in.(${gradeList}))`);
                }
                if (conditions.length === 1) {
                    query = query.in('scope', ['SCHOOL_WIDE', 'UNIVERSAL']);
                } else {
                    query = query.or(conditions.join(','));
                }
            }
        } else if (userRole === UserRole.TEACHER) {
            const { data: teacher } = await client
                .from('teachers')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            const assignedClassIds = new Set<string>();
            const assignedGrades = new Set<number>();

            if (teacher?.id) {
                const { data: assignments } = await client
                    .from('class_teachers')
                    .select('class_id, classes(grade)')
                    .eq('teacher_id', teacher.id);

                for (const a of assignments ?? []) {
                    if (a.class_id) assignedClassIds.add(a.class_id);
                    const grade = (a as any).classes?.grade;
                    if (grade !== undefined && grade !== null) assignedGrades.add(grade);
                }
            }

            if (classId) {
                if (!assignedClassIds.has(classId)) {
                    throw new ForbiddenException('You are not assigned to this class.');
                }
                query = query.eq('target_class_id', classId).eq('scope', 'CLASS_SPECIFIC');
            } else if (parsedGrade !== undefined && !isNaN(parsedGrade)) {
                if (!assignedGrades.has(parsedGrade)) {
                    throw new ForbiddenException('You are not assigned to teach this grade.');
                }
                query = query.eq('target_grade', parsedGrade).eq('scope', 'GRADE_LEVEL');
            } else {
                const conditions: string[] = ['scope.in.(SCHOOL_WIDE,UNIVERSAL)'];
                if (assignedClassIds.size > 0) {
                    const classList = Array.from(assignedClassIds).join(',');
                    conditions.push(`and(scope.eq.CLASS_SPECIFIC,target_class_id.in.(${classList}))`);
                }
                if (assignedGrades.size > 0) {
                    const gradeList = Array.from(assignedGrades).join(',');
                    conditions.push(`and(scope.eq.GRADE_LEVEL,target_grade.in.(${gradeList}))`);
                }
                if (conditions.length === 1) {
                    query = query.in('scope', ['SCHOOL_WIDE', 'UNIVERSAL']);
                } else {
                    query = query.or(conditions.join(','));
                }
            }
        } else {
            query = query.in('scope', ['SCHOOL_WIDE', 'UNIVERSAL']);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
            this.logger.error(`Failed to fetch notices: ${error.message}`);
            throw error;
        }

        const { data: reads } = await client.from('notice_reads').select('notice_id').eq('user_id', userId);
        const readIds = new Set(reads?.map(r => r.notice_id) || []);

        return (data ?? []).map(n => ({ ...n, is_read: readIds.has(n.id) }));
    }

    async markAsRead(tenantId: string, noticeId: string, userId: string) {
        const client = this.supabaseService.getTenantClient(tenantId);
        const { error } = await client.from('notice_reads').insert({ notice_id: noticeId, user_id: userId });

        if (error && error.code !== '23505') throw error;

        return { success: true };
    }

    /**
     * Dispatch genuine cross-tenant announcements (SUPER_ADMIN only).
     * Skips SMS cleanly for Community tier, and uses per-tenant try/catch so
     * one failure does not abort dispatches to other tenants.
     */
    async broadcastGlobalNotice(authorId: string, request: any) {
        if (!request || !request.title) throw new BadRequestException('Invalid Broadcast Payload');

        const db = this.supabaseService.adminClient;
        const { data: tenants, error } = await db
            .from('tenants')
            .select('id, plan, status, name')
            .eq('status', 'ACTIVE');

        if (error || !tenants) return { dispatches: 0, failedTenants: [] };

        this.logger.warn(`GLOBAL BROADCAST INITIATED across ${tenants.length} instances.`);
        let dispatchCount = 0;
        const failedTenants: { tenantId: string; error: string }[] = [];

        for (const tenant of tenants) {
            try {
                // Per blueprint: Community tier has SMS disabled by policy; skip SMS cleanly for Community
                const sendSms = tenant.plan === 'COMMUNITY' ? false : Boolean(request.send_sms);

                await this.createNotice(
                    tenant.id,
                    authorId,
                    {
                        title: request.title,
                        content_html: request.content_html ?? request.content,
                        priority: 'URGENT',
                        scope: 'SCHOOL_WIDE',
                        send_sms: sendSms,
                        bypass_quota: sendSms,
                    },
                    UserRole.SUPER_ADMIN,
                );
                dispatchCount++;
            } catch (err: any) {
                this.logger.error(`Failed to broadcast notice to tenant ${tenant.id} (${tenant.name}): ${err.message}`);
                failedTenants.push({ tenantId: tenant.id, error: err.message });
            }
        }

        return {
            success: true,
            dispatches: dispatchCount,
            totalTenants: tenants.length,
            failedTenants,
        };
    }

    // ── Platform Maintenance Notices (Entity separate from school notices) ─────

    async getActiveMaintenanceNotices() {
        const { data, error } = await this.supabaseService.adminClient
            .from('system_maintenance_notices')
            .select('*')
            .eq('is_active', true)
            .order('scheduled_start', { ascending: false });

        if (error) {
            this.logger.error(`Failed to fetch maintenance notices: ${error.message}`);
            return [];
        }
        return data ?? [];
    }

    async createMaintenanceNotice(authorId: string, dto: any) {
        if (!dto.title || !dto.message) {
            throw new BadRequestException('Title and message are required.');
        }

        const { data, error } = await this.supabaseService.adminClient
            .from('system_maintenance_notices')
            .insert({
                title: dto.title,
                message: dto.message,
                severity: dto.severity || 'INFO',
                scheduled_start: dto.scheduledStart ? new Date(dto.scheduledStart).toISOString() : new Date().toISOString(),
                scheduled_end: dto.scheduledEnd ? new Date(dto.scheduledEnd).toISOString() : null,
                created_by: authorId,
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            this.logger.error(`Failed to create maintenance notice: ${error.message}`);
            throw error;
        }

        // Broadcast in-app banner to all connected clients via Supabase Realtime channel
        try {
            const channel = this.supabaseService.adminClient.channel('system_notifications');
            await channel.send({
                type: 'broadcast',
                event: 'system_notification',
                payload: {
                    id: data.id,
                    title: `[Maintenance] ${data.title}`,
                    message: data.message,
                    timestamp: data.scheduled_start,
                    type: data.severity === 'CRITICAL' ? 'critical' : data.severity === 'WARNING' ? 'warning' : 'info',
                },
            });
        } catch (err: any) {
            this.logger.warn(`Could not broadcast maintenance notice to channel: ${err.message}`);
        }

        return data;
    }

    async deactivateMaintenanceNotice(id: string) {
        const { data, error } = await this.supabaseService.adminClient
            .from('system_maintenance_notices')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.logger.error(`Failed to deactivate maintenance notice: ${error.message}`);
            throw error;
        }
        return { success: true, notice: data };
    }
}
