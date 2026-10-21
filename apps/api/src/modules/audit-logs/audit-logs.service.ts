import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';

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
    private readonly fallbackDiskPath = process.env.AUDIT_LOG_FALLBACK_PATH || '/tmp/edulanka_audit_fallback.log';

    constructor(
        private readonly supabase: SupabaseService,
        @Optional() private readonly redis?: RedisService,
    ) { }

    async logAction(dto: AuditLogDto) {
        const payload = {
            tenant_id: dto.tenantId,
            actor_id: dto.actorId,
            actor_role: dto.actorRole,
            action: dto.action,
            entity_type: dto.entityType,
            entity_id: dto.entityId,
            old_values: dto.oldValues,
            new_values: dto.newValues,
            ip_address: dto.ipAddress ?? 'UNKNOWN',
            created_at: new Date().toISOString(),
        };

        let queuedToRedis = false;

        // 1. Attempt Redis queueing if Redis is available
        if (this.redis) {
            try {
                const redisClient = (this.redis as any).client;
                if (redisClient && typeof redisClient.lpush === 'function') {
                    await redisClient.lpush('audit_events_queue', JSON.stringify(payload));
                    queuedToRedis = true;
                }
            } catch (redisErr: any) {
                this.logger.warn(`Redis audit queueing failed (${redisErr.message}); falling back to direct database persistence.`);
            }
        }

        // 2. Direct database persistence if Redis is not used or queueing failed
        if (!queuedToRedis) {
            let dbSuccess = false;
            try {
                const { error } = await this.supabase.adminClient
                    .from('audit_logs')
                    .insert({
                        tenant_id: payload.tenant_id,
                        actor_id: payload.actor_id,
                        actor_role: payload.actor_role,
                        action: payload.action,
                        entity_type: payload.entity_type,
                        entity_id: payload.entity_id,
                        old_values: payload.old_values,
                        new_values: payload.new_values,
                        ip_address: payload.ip_address,
                    });

                if (error) {
                    this.logger.error(`Database insertion failed for audit log: ${error.message}; falling back to disk persistence.`);
                } else {
                    dbSuccess = true;
                }
            } catch (dbErr: any) {
                this.logger.error(`Database exception for audit log: ${dbErr.message}; falling back to disk persistence.`);
            }

            // 3. Fallback to disk persistence if database write failed
            if (!dbSuccess) {
                this.fallbackToDisk(payload);
            }
        }
    }

    private fallbackToDisk(payload: any): void {
        try {
            const dir = path.dirname(this.fallbackDiskPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.appendFileSync(this.fallbackDiskPath, JSON.stringify(payload) + '\n', 'utf8');
            this.logger.warn(`Audit log successfully persisted to disk fallback: ${this.fallbackDiskPath}`);
        } catch (diskErr: any) {
            this.logger.error(`CRITICAL: Disk fallback for audit log also failed: ${diskErr.message}`);
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
