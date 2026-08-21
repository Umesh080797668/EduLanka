import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
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

    async createNotice(tenantId: string, authorId: string, request: any) {
        const adminClient = this.supabaseService.adminClient;

        const { data: tenant } = await adminClient
            .from('tenants')
            .select('plan')
            .eq('id', tenantId)
            .single();

        if (!tenant) throw new ForbiddenException('Tenant not found');

        const { title, content_html, scope, target_grade, target_class_id, priority, attachments, expires_at, send_sms } = request;

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
            // System Admin overrides mapping
            const forceBypass = request.bypass_quota === true;

            // Background Twilio broadcast via BullMQ Producer. Detached on
            // purpose — the notice is already saved and must not be rolled back
            // by a carrier or quota failure.
            void this.dispatchNoticeSms(tenantId, data, forceBypass);
        }

        return data;
    }

    /**
     * Fan a notice out over SMS to the guardians its scope targets.
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

            this.logger.log(`Queueing ${recipients.length} SMS for notice ${notice.id}`);
            await Promise.all(
                recipients.map((phone) =>
                    this.smsService
                        .sendSms(phone, body, tenantId, notice.id, bypassQuota)
                        .catch((e: any) => this.logger.error(`SMS dispatch to ${phone} failed: ${e.message}`)),
                ),
            );
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

    async getNotices(tenantId: string, userId: string, userRole: string, classId?: string, gradeId?: string) {
        const client = this.supabaseService.getTenantClient(tenantId);

        let query = client.from('notices').select('*, author:users(full_name, role, avatar_url)');

        query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

        if (classId) {
            query = query.eq('target_class_id', classId).eq('scope', 'CLASS_SPECIFIC');
        } else if (gradeId) {
            query = query.eq('target_grade', parseInt(gradeId)).eq('scope', 'GRADE_LEVEL');
        } else if (userRole !== 'SCHOOL_ADMIN' && userRole !== 'SUPER_ADMIN') {
            // General pull for non-admins limits strictly to School-wide bounds if class is omitted
            query = query.in('scope', ['SCHOOL_WIDE', 'UNIVERSAL']);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
            this.logger.error(error);
            throw error;
        }

        const { data: reads } = await client.from('notice_reads').select('notice_id').eq('user_id', userId);
        const readIds = new Set(reads?.map(r => r.notice_id) || []);

        return data.map(n => ({ ...n, is_read: readIds.has(n.id) }));
    }

    async markAsRead(tenantId: string, noticeId: string, userId: string) {
        const client = this.supabaseService.getTenantClient(tenantId);
        const { error } = await client.from('notice_reads').insert({ notice_id: noticeId, user_id: userId });

        // Supabase foreign key triggers handle clean constraint violations silently if it already exists
        if (error && error.code !== '23505') throw error;

        return { success: true };
    }

    async broadcastGlobalNotice(authorId: string, request: any) {
        if (!request || !request.title) throw new Error('Invalid Broadcast Payload');

        const db = this.supabaseService.adminClient;
        const { data: tenants } = await db.from('tenants').select('id, plan, status').eq('status', 'ACTIVE');

        if (!tenants) return { dispatches: 0 };

        this.logger.warn(`GLOBAL BROADCAST INITIATED across ${tenants.length} instances.`);
        let dispatchCount = 0;

        for (const tenant of tenants) {
            // System overrides tenant blockages dynamically
            await this.createNotice(tenant.id, authorId, {
                title: request.title,
                content_html: request.content_html ?? request.content,
                priority: 'URGENT',
                scope: 'SCHOOL_WIDE',
                send_sms: request.send_sms,
                bypass_quota: request.send_sms // Assuming send_sms globally maps directly to Disaster Overrides for Super Admins
            });
            dispatchCount++;
        }

        return { success: true, dispatches: dispatchCount };
    }
}
