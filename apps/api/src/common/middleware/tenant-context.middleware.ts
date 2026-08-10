import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { FastifyRequest } from 'fastify';
import { NestMiddleware } from '@nestjs/common';

import type { AppConfiguration } from '../../config/configuration';

/** Shape attached to every tenant-scoped request */
export interface TenantContext {
    tenantId: string;
    slug: string;
    schemaName: string; // tenant_<slug>
    plan: string;
}

declare module 'fastify' {
    interface FastifyRequest {
        tenantContext?: TenantContext;
    }
}

/** Simple time-based LRU cache (5-minute TTL) */
interface CacheEntry {
    ctx: TenantContext;
    expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes
const cache = new Map<string, CacheEntry>();

/**
 * TenantContextMiddleware
 *
 * Reads the `x-tenant-slug` request header, looks up the tenant in
 * `public.tenants`, validates it is ACTIVE, then attaches a `tenantContext`
 * to the request for downstream handlers.
 *
 * Routes excluded: /api/v1/health, /api/v1/auth/*
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
    private readonly logger = new Logger(TenantContextMiddleware.name);
    private readonly supabase;

    constructor(private readonly configService: ConfigService<AppConfiguration>) {
        const url = this.configService.get('supabase.url', { infer: true })!;
        const key = this.configService.get('supabase.serviceRoleKey', { infer: true })!;
        this.supabase = createClient(url, key, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
    }

    async use(req: FastifyRequest, _res: unknown, next: () => void): Promise<void> {
        // Fastify/Middie often strips the base path in `req.url` Down to `/`, so we must use `originalUrl`!
        const path: string = (req as any).originalUrl || req.url || '';

        // Skip middleware for global health, auth, and swagger routes
        this.logger.debug(`[TenantContextMiddleware] Evaluating path: ${path}`);
        if (path.includes('/health') || path.includes('/auth') || path.includes('/docs')) {
            return next();
        }

        const isSuperAdminTenantRoute =
            (req.method === 'POST' && path === '/api/v1/tenants') ||
            (req.method === 'GET' && path === '/api/v1/tenants') ||
            (req.method === 'PATCH' && path.match(/^.*\/api\/v1\/tenants\/[^\/]+\/status$/));

        if (isSuperAdminTenantRoute) {
            return next();
        }

        const tenantId = (req.headers['x-tenant-id'] as string | undefined)?.trim();

        if (!tenantId) {
            throw new BadRequestException(
                'Missing required header: x-tenant-id',
            );
        }

        // Check in-memory LRU cache first
        const cached = cache.get(tenantId);
        if (cached && cached.expiresAt > Date.now()) {
            req.tenantContext = cached.ctx;
            return next();
        }

        // Resolve from Supabase public.tenants
        const { data, error } = await this.supabase
            .from('tenants')
            .select('id, slug, plan, status')
            .eq('id', tenantId)
            .maybeSingle();

        if (error) {
            this.logger.error(`Tenant lookup error for id "${tenantId}": ${error.message}`);
            throw new BadRequestException('Tenant resolution failed');
        }

        if (!data) {
            throw new NotFoundException(`Tenant not found: ${tenantId}`);
        }

        if (data.status !== 'ACTIVE') {
            throw new BadRequestException(
                `Tenant "${data.slug}" is not active (status: ${data.status})`,
            );
        }

        const ctx: TenantContext = {
            tenantId: data.id as string,
            slug: data.slug as string,
            schemaName: `tenant_${data.slug}`,
            plan: data.plan as string,
        };

        // Cache for TTL
        cache.set(tenantId, { ctx, expiresAt: Date.now() + CACHE_TTL_MS });

        req.tenantContext = ctx;
        return next();
    }
}
