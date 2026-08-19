import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface AuditLogDto {
    tenantId: string | null;
    actorId: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
}

@Injectable()
export class AuditLogsService {
    private readonly logger = new Logger(AuditLogsService.name);

    constructor(private readonly supabase: SupabaseService) { }

    async logAction(dto: AuditLogDto) {
        try {
            // Using adminClient so we bypass RLS for logging logic locally but store standard context
            const { error } = await this.supabase.adminClient
                .from('audit_logs')
                .insert({
                    tenant_id: dto.tenantId,
                    actor_id: dto.actorId,
                    actor_role: dto.actorRole,
                    action: dto.action,
                    entity_type: dto.entityType,
                    entity_id: dto.entityId,
                    old_values: dto.oldValues,
                    new_values: dto.newValues,
                    ip_address: dto.ipAddress ?? 'UNKNOWN'
                });

            if (error) {
                this.logger.error(`Failed to ingest audit log: ${error.message}`);
            }
        } catch (e: any) {
            this.logger.error(`Failed to write audit log: ${e.message}`);
        }
    }
    async listLogs(limit: number = 50, offset: number = 0, targetUserId?: string) {
        try {
            let query = this.supabase.adminClient
                .from('audit_logs')
                .select('*', { count: 'exact' });

            if (targetUserId) {
                query = query.or(`actor_id.eq.${targetUserId},entity_id.eq.${targetUserId}`);
            }

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                this.logger.error(`Failed to list audit logs: ${error.message}`);
                throw new Error('Failed to retrieve audit logs');
            }

            return {
                data: data || [],
                total: count || 0,
                page: Math.floor(offset / limit) + 1,
                limit
            };
        } catch (e: any) {
            this.logger.error(`Exception in listLogs: ${e.message}`);
            throw e;
        }
    }
}
