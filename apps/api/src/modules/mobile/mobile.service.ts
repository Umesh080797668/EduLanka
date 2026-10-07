import { randomUUID } from 'crypto';

import type { JwtPayload } from '@edu-lanka/shared-types';
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';

import { SupabaseService } from '../supabase/supabase.service';

import type { RegisterDeviceTokenDto, AppendSyncEventDto, TriggerDisasterPushDto } from './dto/mobile.dto';

@Injectable()
export class MobileService {
    private readonly logger = new Logger(MobileService.name);

    constructor(private readonly supabase: SupabaseService) { }

    /**
     * Registers or updates an FCM device token for the caller.
     */
    async registerDeviceToken(dto: RegisterDeviceTokenDto, caller: JwtPayload) {
        const client = this.supabase.adminClient;

        const { data, error } = await client
            .from('device_tokens')
            .upsert(
                {
                    tenant_id: caller.tenantId,
                    user_id: caller.sub,
                    token: dto.token,
                    platform: dto.platform,
                    device_model: dto.deviceModel ?? null,
                    is_active: true,
                    last_seen_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'token' },
            )
            .select('*')
            .single();

        if (error) {
            this.logger.error(`Failed to register device token: ${error.message}`);
            throw new InternalServerErrorException('Failed to register device token');
        }

        return {
            success: true,
            deviceToken: data,
        };
    }

    /**
     * Appends a sync event using the atomic append_sync_event function.
     */
    async appendSyncEvent(dto: AppendSyncEventDto, caller: JwtPayload) {
        const client = this.supabase.adminClient;

        const { data, error } = await client.rpc('append_sync_event', {
            p_tenant_id: caller.tenantId,
            p_entity_type: dto.entityType,
            p_entity_id: dto.entityId,
            p_event_type: dto.eventType,
            p_payload: dto.payload ?? {},
            p_client_uuid: dto.clientUuid,
        });

        if (error) {
            this.logger.error(`append_sync_event RPC failed: ${error.message}`);
            throw new InternalServerErrorException(`Sync event ingestion failed: ${error.message}`);
        }

        return {
            success: true,
            event: data,
        };
    }

    /**
     * Retrieves sync events strictly partition-scoped to the caller's tenant.
     */
    async getSyncEvents(caller: JwtPayload, sinceSequence = 0) {
        const client = this.supabase.adminClient;

        const { data, error } = await client
            .from('sync_events')
            .select('*')
            .eq('tenant_id', caller.tenantId)
            .gt('sequence', sinceSequence)
            .order('sequence', { ascending: true })
            .limit(200);

        if (error) {
            this.logger.error(`Failed to query sync_events: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch sync stream');
        }

        return {
            tenantId: caller.tenantId,
            sinceSequence,
            events: data ?? [],
        };
    }

    /**
     * Generates and returns the offline Disaster Pack bundle for the school tenant.
     */
    async getDisasterPack(caller: JwtPayload) {
        const tenantClient = this.supabase.getTenantClient(caller.tenantId);

        // Fetch active notices
        const { data: notices } = await tenantClient
            .from('notices')
            .select('id, title, content, priority, created_at')
            .order('created_at', { ascending: false })
            .limit(20);

        // Fetch school policies
        const { data: policies } = await tenantClient
            .from('school_policies')
            .select('id, title, content, category, updated_at')
            .limit(50);

        // Fetch tenant details
        const { data: tenant } = await this.supabase
            .adminClient
            .from('tenants')
            .select('id, name, slug, contact_email, address_city, address_district')
            .eq('id', caller.tenantId)
            .single();

        return {
            tenantId: caller.tenantId,
            schoolName: tenant?.name ?? 'EduLanka School',
            generatedAt: new Date().toISOString(),
            status: 'DISASTER_PACK_READY',
            emergencyContacts: [
                { title: 'School Principal', email: tenant?.contact_email ?? 'admin@school.lk' },
                { title: 'Zonal Education Office', phone: '1919' },
                { title: 'Disaster Management Centre', hotline: '117' },
            ],
            notices: notices ?? [],
            policies: policies ?? [],
        };
    }

    /**
     * Triggers an emergency Disaster Mode push notification to registered devices in the tenant.
     */
    async triggerDisasterPush(dto: TriggerDisasterPushDto, caller: JwtPayload) {
        const client = this.supabase.adminClient;

        // 1. Record Disaster Event in Sync Event stream
        const clientUuid = randomUUID();
        const payload = {
            type: 'DISASTER_MODE_ACTIVATED',
            tenant_id: caller.tenantId,
            reason: dto.reason ?? 'NATURAL_DISASTER',
            expected_duration: dto.expectedDuration ?? '3_DAYS',
            timestamp: Date.now(),
        };

        const { data: syncEvent, error: syncErr } = await client.rpc('append_sync_event', {
            p_tenant_id: caller.tenantId,
            p_entity_type: 'disaster_mode',
            p_entity_id: caller.sub,
            p_event_type: 'CREATED',
            p_payload: payload,
            p_client_uuid: clientUuid,
        });

        if (syncErr) {
            this.logger.error(`Failed to append disaster sync event: ${syncErr.message}`);
            throw new InternalServerErrorException('Failed to record disaster event');
        }

        // 2. Query active device tokens registered for this specific tenant
        const { data: tokens, error: tokenErr } = await client
            .from('device_tokens')
            .select('token, platform, user_id')
            .eq('tenant_id', caller.tenantId)
            .eq('is_active', true);

        if (tokenErr) {
            this.logger.error(`Failed to fetch device tokens: ${tokenErr.message}`);
        }

        const registeredTokens = (tokens ?? []).map((t: any) => t.token);

        this.logger.log(
            `Disaster Mode Triggered for tenant ${caller.tenantId}. Active FCM tokens targeted: ${registeredTokens.length}`,
        );

        return {
            success: true,
            syncEvent,
            pushPayload: payload,
            registeredTokensCount: registeredTokens.length,
            targetTokens: registeredTokens,
            dispatchedAt: new Date().toISOString(),
        };
    }
}
