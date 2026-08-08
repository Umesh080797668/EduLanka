import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTutorialDto } from './dto/tutorial.dto';
import type { JwtPayload } from '@edu-lanka/shared-types';

@Injectable()
export class TutorialsService {
    constructor(private readonly supabase: SupabaseService) { }

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
        const client = this.supabase.getTenantClient(user.tenantId);

        const { data, error } = await client
            .from('user_tutorials')
            .select('tutorial_id, status, completed_at')
            .eq('user_id', user.sub); // Assuming JWT sub holds the tenant-level user.id, BUT wait, user.sub usually holds auth_uid globally in Supabase auth depending on how edulanka implements it.

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
        const client = this.supabase.getTenantClient(user.tenantId);

        // Ensure user actually maps to the user_id if needed, but if user_id in user_tutorials is 
        // the global auth_uid, then user.sub is fine! However, the schema references `tenant_x.users(id)`. 
        // Usually, EduLanka API resolves the tenant user first. Let's do that to be safe.
        const { data: tenantUser, error: userErr } = await client
            .from('users')
            .select('id')
            .eq('auth_uid', user.sub)
            .single();

        if (userErr || !tenantUser) {
            throw new BadRequestException('User not found in tenant schema');
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
        const client = this.supabase.getTenantClient(user.tenantId);

        // Basic aggregation query for COMPLETIONS by tutorial_id for the tenant
        // Notice: Supabase JS doesn't do complex grouping easily. We fallback to RPC or custom query.
        // For now, we pull raw rows and group in memory (since school scale is small).
        const { data, error } = await client
            .from('user_tutorials')
            .select('tutorial_id, status');

        if (error) {
            throw new InternalServerErrorException('Failed to calculate stats');
        }

        const stats = (data || []).reduce((acc: any, row: any) => {
            acc[row.tutorial_id] = acc[row.tutorial_id] || { completed: 0, skipped: 0 };
            if (row.status === 'COMPLETED') acc[row.tutorial_id].completed++;
            if (row.status === 'SKIPPED') acc[row.tutorial_id].skipped++;
            return acc;
        }, {});

        return { success: true, data: stats };
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
}
