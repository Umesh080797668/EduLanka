import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SmsService } from '../sms/sms.service';

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
                content_html,
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
            this.logger.log(`SMS globally queued for Notice ID ${data.id}`);

            // System Admin overrides mapping
            const forceBypass = request.bypass_quota === true;

            // Background Twilio broadcast via BullMQ Producer
            this.smsService.sendSms('+15555555555', `[EduLanka] Urgent Notice: ${title}`, tenantId, data.id, forceBypass).catch(e => {
                this.logger.error(`SMS Dispatcher failure: ${e.message}`);
            });
        }

        return data;
    }

    async getNotices(tenantId: string, userId: string, userRole: string, classId?: string, gradeId?: string) {
        const client = this.supabaseService.getTenantClient(tenantId);

        let query = client.from('notices').select('*, author:users(first_name, last_name, role)');

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
                content: request.content,
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
