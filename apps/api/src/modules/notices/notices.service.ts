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

        const { title, content_html, scope, target_group_id, priority, attachments, expires_at, send_sms } = request;

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
                target_group_id,
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

            // Background Twilio broadcast simulation
            this.smsService.sendSms('+15555555555', `[EduLanka] Urgent Notice: ${title}`).catch(e => {
                this.logger.error(`SMS Dispatcher failure: ${e.message}`);
            });
        }

        return data;
    }

    async getNotices(tenantId: string, userId: string, _userRole: string) {
        const client = this.supabaseService.getTenantClient(tenantId);

        let query = client.from('notices').select('*, author:users(first_name, last_name, role)');

        query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

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
}
