import {
    Injectable,
    Logger,
    NotFoundException,
    InternalServerErrorException,
} from '@nestjs/common';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { SupabaseService, assertUuid } from '../supabase/supabase.service';
import type { CreatePaperDto, AttachMarkingSchemeDto } from './dto/create-paper.dto';

@Injectable()
export class PaperHubService {
    private readonly logger = new Logger(PaperHubService.name);

    constructor(private readonly supabase: SupabaseService) { }

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
     * Retrieves a single paper by ID.
     */
    async getPaperById(paperId: string) {
        assertUuid(paperId, 'paperId');

        const { data, error } = await this.supabase.adminClient
            .from('papers')
            .select('*')
            .eq('id', paperId)
            .maybeSingle();

        if (error || !data) {
            throw new NotFoundException(`Paper with ID ${paperId} not found`);
        }

        return data;
    }

    /**
     * Uploads a tenant-specific examination paper.
     */
    async createPaper(caller: JwtPayload, dto: CreatePaperDto) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        const isPaired = Boolean(dto.markingSchemeUrl);

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
                is_paired: isPaired,
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
            is_paired: Boolean(p.markingSchemeUrl),
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
     * Attaches a marking scheme to an existing paper and marks it paired.
     */
    async attachMarkingScheme(paperId: string, dto: AttachMarkingSchemeDto) {
        assertUuid(paperId, 'paperId');

        const { data, error } = await this.supabase.adminClient
            .from('papers')
            .update({
                marking_scheme_cloudinary_id: dto.markingSchemeCloudinaryId,
                marking_scheme_url: dto.markingSchemeUrl,
                is_paired: true,
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
