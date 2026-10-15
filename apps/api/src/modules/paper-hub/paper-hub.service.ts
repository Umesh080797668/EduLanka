import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { SupabaseService, assertUuid } from '../supabase/supabase.service';
import type { CreatePaperDto, AttachMarkingSchemeDto } from './dto/create-paper.dto';

export function isAllowedDocumentUrl(urlStr?: string): boolean {
    if (!urlStr || typeof urlStr !== 'string') return false;
    try {
        const parsed = new URL(urlStr);
        if (parsed.protocol !== 'https:') {
            return false;
        }
        const host = parsed.hostname.toLowerCase();
        const isProd = process.env['NODE_ENV'] === 'production';
        if (isProd && (host === 'localhost' || host === '127.0.0.1' || host === '::1')) {
            return false;
        }
        return (
            host === 'res.cloudinary.com' ||
            host.endsWith('.cloudinary.com') ||
            host.endsWith('.supabase.co') ||
            (!isProd && (host === 'localhost' || host === '127.0.0.1'))
        );
    } catch {
        return false;
    }
}

@Injectable()
export class PaperHubService {
    private readonly logger = new Logger(PaperHubService.name);

    constructor(private readonly supabase: SupabaseService) { }

    private async assertPlanEntitlement(caller: JwtPayload) {
        if (caller.role === UserRole.SUPER_ADMIN) return;

        let plan = caller.tenantPlan;
        if (!plan && caller.tenantId) {
            const { data: tenant } = await this.supabase.adminClient
                .from('tenants')
                .select('plan')
                .eq('id', caller.tenantId)
                .maybeSingle();
            plan = tenant?.plan as any;
        }

        const isGrowthOrAbove = plan === 'GROWTH' || plan === 'INSTITUTIONAL';
        if (!isGrowthOrAbove) {
            throw new ForbiddenException(
                'Past Paper Hub requires a Growth or Institutional plan subscription',
            );
        }
    }

    /**
     * Lists national past papers and tenant-specific examination papers.
     */
    async listPapers(
        caller: JwtPayload,
        options: {
            page?: number;
            limit?: number;
            subject?: string;
            gradeLevel?: number;
            examType?: string;
            medium?: string;
            year?: number;
        },
    ) {
        await this.assertPlanEntitlement(caller);
        if (caller.tenantId) {
            assertUuid(caller.tenantId, 'tenantId');
        }
        const page = Math.max(1, options.page || 1);
        const limit = Math.min(Math.max(1, options.limit || 20), 100);
        const offset = (page - 1) * limit;

        const client = this.supabase.adminClient;

        // Query papers: either national (tenant_id IS NULL) OR tenant-specific
        let query = client
            .from('papers')
            .select('*', { count: 'exact' })
            .or(`tenant_id.is.null,tenant_id.eq.${caller.tenantId}`)
            .order('exam_year', { ascending: false })
            .range(offset, offset + limit - 1);

        if (options.subject) {
            query = query.eq('subject', options.subject);
        }
        if (options.gradeLevel) {
            query = query.eq('grade_level', options.gradeLevel);
        }
        if (options.examType) {
            query = query.eq('exam_type', options.examType);
        }
        if (options.medium) {
            query = query.eq('medium', options.medium);
        }
        if (options.year) {
            query = query.eq('exam_year', options.year);
        }

        const { data, count, error } = await query;
        if (error) {
            this.logger.error(`Failed to list papers: ${error.message}`);
            throw new InternalServerErrorException('Failed to retrieve past papers');
        }

        return {
            data: data || [],
            total: count || 0,
            page,
            limit,
            hasMore: (count || 0) > offset + limit,
        };
    }

    /**
     * Retrieves a single paper by ID with tenant isolation check.
     */
    async getPaperById(caller: JwtPayload, paperId: string) {
        await this.assertPlanEntitlement(caller);
        assertUuid(paperId, 'paperId');

        const { data, error } = await this.supabase.adminClient
            .from('papers')
            .select('*')
            .eq('id', paperId)
            .maybeSingle();

        if (error || !data) {
            throw new NotFoundException(`Paper with ID ${paperId} not found`);
        }

        // Cross-tenant protection:
        // National papers (tenant_id IS NULL) are accessible to all authenticated users.
        // School-specific papers (tenant_id IS NOT NULL) can only be viewed by users
        // belonging to that school or platform SUPER_ADMIN.
        if (data.tenant_id !== null && caller.role !== UserRole.SUPER_ADMIN && caller.tenantId !== data.tenant_id) {
            throw new ForbiddenException('Access denied: You do not have permission to view examination papers of another institution');
        }

        return data;
    }

    /**
     * Uploads a tenant-specific examination paper.
     */
    async createPaper(caller: JwtPayload, dto: CreatePaperDto) {
        await this.assertPlanEntitlement(caller);
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        if (!isAllowedDocumentUrl(dto.paperUrl)) {
            throw new BadRequestException('paperUrl must be a secure HTTPS URL from an authorized host');
        }
        if (dto.markingSchemeUrl && !isAllowedDocumentUrl(dto.markingSchemeUrl)) {
            throw new BadRequestException('markingSchemeUrl must be a secure HTTPS URL from an authorized host');
        }

        const { data, error } = await this.supabase.adminClient
            .from('papers')
            .insert({
                tenant_id: caller.tenantId,
                title: dto.title,
                subject: dto.subject,
                grade_level: dto.gradeLevel,
                exam_year: dto.examYear,
                exam_type: dto.examType,
                medium: dto.medium,
                paper_cloudinary_id: dto.paperCloudinaryId,
                paper_url: dto.paperUrl,
                marking_scheme_cloudinary_id: dto.markingSchemeCloudinaryId || null,
                marking_scheme_url: dto.markingSchemeUrl || null,
                uploaded_by: caller.sub,
            })
            .select('*')
            .single();

        if (error) {
            this.logger.error(`Failed to create paper: ${error.message}`);
            throw new InternalServerErrorException('Failed to create examination paper');
        }

        return {
            success: true,
            paper: data,
        };
    }

    /**
     * Bulk upload national papers (Super Admin only, tenant_id = NULL).
     */
    async bulkUploadNationalPapers(caller: JwtPayload, papers: CreatePaperDto[]) {
        assertUuid(caller.sub, 'userId');

        if (!Array.isArray(papers) || papers.length === 0 || papers.length > 100) {
            throw new BadRequestException('Bulk upload batch size must be between 1 and 100 papers');
        }

        for (const p of papers) {
            if (!isAllowedDocumentUrl(p.paperUrl)) {
                throw new BadRequestException(`Invalid paperUrl "${p.paperUrl}": must be a secure HTTPS URL from an authorized host`);
            }
            if (p.markingSchemeUrl && !isAllowedDocumentUrl(p.markingSchemeUrl)) {
                throw new BadRequestException(`Invalid markingSchemeUrl "${p.markingSchemeUrl}": must be a secure HTTPS URL from an authorized host`);
            }
        }

        const rows = papers.map((p) => ({
            tenant_id: null, // National global hub
            title: p.title,
            subject: p.subject,
            grade_level: p.gradeLevel,
            exam_year: p.examYear,
            exam_type: p.examType,
            medium: p.medium,
            paper_cloudinary_id: p.paperCloudinaryId,
            paper_url: p.paperUrl,
            marking_scheme_cloudinary_id: p.markingSchemeCloudinaryId || null,
            marking_scheme_url: p.markingSchemeUrl || null,
            uploaded_by: caller.sub,
        }));

        const { data, error } = await this.supabase.adminClient
            .from('papers')
            .insert(rows)
            .select('*');

        if (error) {
            this.logger.error(`Bulk upload national papers failed: ${error.message}`);
            throw new InternalServerErrorException('Failed to bulk upload national papers');
        }

        return {
            success: true,
            count: data?.length || 0,
            papers: data,
        };
    }

    /**
     * Attaches a marking scheme to an existing paper and marks it paired with ownership checks.
     */
    async attachMarkingScheme(caller: JwtPayload, paperId: string, dto: AttachMarkingSchemeDto) {
        await this.assertPlanEntitlement(caller);
        assertUuid(paperId, 'paperId');

        if (!isAllowedDocumentUrl(dto.markingSchemeUrl)) {
            throw new BadRequestException('markingSchemeUrl must be a secure HTTPS URL from an authorized host');
        }

        const { data: existingPaper, error: fetchError } = await this.supabase.adminClient
            .from('papers')
            .select('*')
            .eq('id', paperId)
            .maybeSingle();

        if (fetchError || !existingPaper) {
            throw new NotFoundException(`Paper with ID ${paperId} not found`);
        }

        // Ownership checks:
        // National papers (tenant_id IS NULL) can ONLY be modified by SUPER_ADMIN.
        // School papers can only be modified by SUPER_ADMIN or admins of that school.
        if (existingPaper.tenant_id === null) {
            if (caller.role !== UserRole.SUPER_ADMIN) {
                throw new ForbiddenException('Only Super Admins can attach marking schemes to national papers');
            }
        } else {
            if (caller.role !== UserRole.SUPER_ADMIN && caller.tenantId !== existingPaper.tenant_id) {
                throw new ForbiddenException('Access denied: You cannot modify examination papers of another institution');
            }
        }

        const { data, error } = await this.supabase.adminClient
            .from('papers')
            .update({
                marking_scheme_cloudinary_id: dto.markingSchemeCloudinaryId,
                marking_scheme_url: dto.markingSchemeUrl,
                updated_at: new Date().toISOString(),
            })
            .eq('id', paperId)
            .select('*')
            .single();

        if (error || !data) {
            this.logger.error(`Failed to attach marking scheme: ${error?.message}`);
            throw new NotFoundException(`Paper with ID ${paperId} not found`);
        }

        return {
            success: true,
            paper: data,
        };
    }
}
