import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SupabaseService } from '../supabase/supabase.service';
import { ReportCardsService, BULK_REPORT_CARDS_QUEUE_NAME } from './report-cards.service';

export interface BulkReportCardJobData {
    tenantId: string;
    term: number;
    academicYear: number;
    classId?: string | null;
    triggeredBy: string;
}

@Processor(BULK_REPORT_CARDS_QUEUE_NAME)
export class BulkReportCardsProcessor extends WorkerHost {
    private readonly logger = new Logger(BulkReportCardsProcessor.name);

    constructor(
        private readonly reportCardsService: ReportCardsService,
        private readonly supabase: SupabaseService,
    ) {
        super();
    }

    async process(job: Job<BulkReportCardJobData>): Promise<any> {
        const { tenantId, term, academicYear, classId, triggeredBy } = job.data;
        this.logger.log(`Processing bulk report cards job ${job.id} for tenant ${tenantId}, Term ${term}, ${academicYear}`);

        const db = this.supabase.getTenantClient(tenantId);

        let query = db
            .from('students')
            .select('id, user_id, class_id')
            .eq('tenant_id', tenantId);

        if (classId) {
            query = query.eq('class_id', classId);
        }

        const { data: students, error } = await query;
        if (error) {
            this.logger.error(`Failed to fetch students for bulk report cards: ${error.message}`);
            throw new Error(`Failed to fetch students: ${error.message}`);
        }

        const studentList = students || [];
        const total = studentList.length;
        this.logger.log(`Found ${total} students for bulk report card generation`);

        let generatedCount = 0;
        let failedCount = 0;
        const failedStudentIds: string[] = [];

        // Synthesize an admin caller context for generating each student card
        const caller: any = {
            sub: triggeredBy,
            tenantId,
            role: 'SCHOOL_ADMIN',
        };

        for (let i = 0; i < studentList.length; i++) {
            const student = studentList[i];
            try {
                await this.reportCardsService.generateReportCard(student.id, term, academicYear, caller);
                generatedCount++;
            } catch (err: any) {
                this.logger.error(`Error generating report card for student ${student.id}: ${err.message}`);
                failedCount++;
                failedStudentIds.push(student.id);
            }

            if (typeof job.updateProgress === 'function') {
                await job.updateProgress({
                    completed: i + 1,
                    total,
                    percentage: total > 0 ? Math.round(((i + 1) / total) * 100) : 100,
                });
            }
        }

        return {
            success: true,
            tenantId,
            term,
            academicYear,
            classId: classId || null,
            totalStudents: total,
            generatedCount,
            failedCount,
            failedStudentIds,
            completedAt: new Date().toISOString(),
        };
    }
}
