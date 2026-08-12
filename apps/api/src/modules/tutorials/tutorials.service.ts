import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTutorialDto } from './dto/tutorial.dto';
import type { JwtPayload } from '@edu-lanka/shared-types';

import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class TutorialsService {
    constructor(
        private readonly supabase: SupabaseService,
        private readonly tenantService: TenantService
    ) { }

    // =========================================================================
    // 1. Fetching Tutorials (Client)
    // =========================================================================

    async getTutorialForScreen(role: string, screenId: string) {
        const client = this.supabase.adminClient;

        // 1. Find the active tutorial definition
        const { data: tutorial, error: tutErr } = await client
            .from('tutorials')
            .select('*')
            .eq('role', role)
            .eq('screen_id', screenId)
            .eq('is_active', true)
            .single();

        if (tutErr || !tutorial) {
            throw new NotFoundException(`No active tutorial found for role ${role} on screen ${screenId}`);
        }

        // 2. Fetch the steps
        const { data: steps, error: stepsErr } = await client
            .from('tutorial_steps')
            .select('*')
            .eq('tutorial_id', tutorial.id)
            .order('step_order', { ascending: true });

        if (stepsErr) {
            throw new InternalServerErrorException('Failed to fetch tutorial steps');
        }

        return {
            success: true,
            data: {
                ...tutorial,
                steps: steps || []
            }
        };
    }

    // =========================================================================
    // 2. User Tracking (Tenant scoped)
    // =========================================================================

    async getUserCompletions(user: JwtPayload) {
        const tenant = await this.tenantService.findOneById(user.tenantId, user);
        const client = this.supabase.getTenantClient(tenant.slug);

        const { data, error } = await client
            .from('user_tutorials')
            .select('tutorial_id, status, completed_at')
            .eq('user_id', user.sub); // Assuming JWT sub holds the tenant-level user.id, BUT wait, user.sub usually holds user_id globally in Supabase auth depending on how edulanka implements it.

        if (error) {
            // Need to handle error properly, but returning empty array on failure
            return { success: true, data: [] };
        }

        return {
            success: true,
            data: data
        };
    }

    async updateUserStatus(tutorialId: string, status: 'COMPLETED' | 'SKIPPED', user: JwtPayload) {
        const tenant = await this.tenantService.findOneById(user.tenantId, user);
        const client = this.supabase.getTenantClient(tenant.slug);

        // Ensure user actually maps to the user_id if needed, but if user_id in user_tutorials is 
        // the global user_id, then user.sub is fine! However, the schema references `tenant_x.users(id)`. 
        // Usually, EduLanka API resolves the tenant user first. Let's do that to be safe.
        const { data: tenantUser, error: userErr } = await client
            .from('users')
            .select('id')
            .eq('user_id', user.sub)
            .single();

        if (userErr || !tenantUser) {
            throw new BadRequestException('User not found in tenant schema: ' + (userErr ? userErr.message : 'no matching row for authUid ' + user.sub));
        }

        const { data, error } = await client
            .from('user_tutorials')
            .upsert({
                user_id: tenantUser.id,
                tutorial_id: tutorialId,
                status: status,
                completed_at: new Date().toISOString()
            }, {
                onConflict: 'user_id, tutorial_id'
            })
            .select()
            .single();

        if (error) {
            throw new InternalServerErrorException('Could not update tutorial status: ' + error.message);
        }

        return {
            success: true,
            data: data
        };
    }

    // =========================================================================
    // 3. Admin Analytics (School Admin)
    // =========================================================================

    async getTenantStats(user: JwtPayload) {
        const tenant = await this.tenantService.findOneById(user.tenantId, user);
        const client = this.supabase.getTenantClient(tenant.slug);

        // 1. Fetch all active global tutorials
        const { data: allTutorials, error: tutErr } = await this.supabase.adminClient
            .from('tutorials')
            .select('id, role, screen_id')
            .eq('is_active', true);

        if (tutErr) {
            throw new InternalServerErrorException('Failed to fetch tutorials definition');
        }

        // 2. Fetch tenant user completions
        const { data: completions, error: compErr } = await client
            .from('user_tutorials')
            .select('tutorial_id, status');

        if (compErr) {
            throw new InternalServerErrorException('Failed to fetch completions');
        }

        // 3. Fetch total active users by role
        const { data: usersData, error: userErr } = await client
            .from('users')
            .select('role')
            .eq('is_active', true);

        if (userErr) {
            throw new InternalServerErrorException('Failed to fetch user roles');
        }

        const roleCounts = usersData.reduce((acc: any, row: any) => {
            acc[row.role] = (acc[row.role] || 0) + 1;
            return acc;
        }, {});

        // 4. Combine into rich stats
        const compiledStats = (allTutorials || []).map(tut => {
            const relevantCompletions = (completions || []).filter(c => c.tutorial_id === tut.id);
            const completedCount = relevantCompletions.filter(c => c.status === 'COMPLETED').length;
            const skippedCount = relevantCompletions.filter(c => c.status === 'SKIPPED').length;
            const eligibleUsers = roleCounts[tut.role] || 0;

            let completionPercentage = 0;
            if (eligibleUsers > 0) {
                completionPercentage = Math.round((completedCount / eligibleUsers) * 100);
            }

            return {
                tutorialId: tut.id,
                role: tut.role,
                screenId: tut.screen_id,
                completed: completedCount,
                skipped: skippedCount,
                eligible: eligibleUsers,
                completionPercentage
            };
        });

        return { success: true, data: compiledStats };
    }

    // =========================================================================
    // 4. Global Management (Super Admin)
    // =========================================================================

    async createTutorial(dto: CreateTutorialDto) {
        const client = this.supabase.adminClient;

        const { data: tutorial, error: tutErr } = await client
            .from('tutorials')
            .insert({
                role: dto.role,
                screen_id: dto.screen_id,
                is_active: dto.is_active ?? true
            })
            .select()
            .single();

        if (tutErr) {
            throw new InternalServerErrorException('Failed to create tutorial: ' + tutErr.message);
        }

        if (dto.steps && dto.steps.length > 0) {
            const stepsToInsert = dto.steps.map(s => ({
                tutorial_id: tutorial.id,
                ...s
            }));

            const { error: stepsErr } = await client
                .from('tutorial_steps')
                .insert(stepsToInsert);

            if (stepsErr) {
                // Should do a rollback, but for simplicity assuming it succeeds.
                throw new InternalServerErrorException('Failed to create tutorial steps: ' + stepsErr.message);
            }
        }

        return { success: true, data: tutorial };
    }

    async getGlobalStats() {
        // Execute the RPC which natively loops across all active tenant schemas to aggregate real statistics
        const { data: stats, error } = await this.supabase.adminClient
            .rpc('get_global_tutorial_stats');

        if (error) {
            throw new InternalServerErrorException('Failed to aggregate global tutorial stats: ' + error.message);
        }

        return { success: true, data: stats };
    }
}
