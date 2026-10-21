import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { InjectQueue } from '@nestjs/bullmq';
import {
    Injectable,
    Logger,
    InternalServerErrorException,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Optional,
} from '@nestjs/common';
import { Queue } from 'bullmq';

import { SupabaseService } from '../supabase/supabase.service';
import { TenantService } from '../tenant/tenant.service';
import { BulkReportCardsDto } from './dto/bulk-report-cards.dto';

export const BULK_REPORT_CARDS_QUEUE_NAME = 'bulk-report-cards';

@Injectable()
export class ReportCardsService {
    private readonly logger = new Logger(ReportCardsService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly tenantService: TenantService,
        @Optional() @InjectQueue(BULK_REPORT_CARDS_QUEUE_NAME) private readonly bulkQueue?: Queue,
    ) { }

    async generateReportCard(studentId: string, term: number, year: number, caller: JwtPayload): Promise<Buffer> {
        const tenant = await this.tenantService.findOneById(caller.tenantId, caller);
        const db = this.supabase.getTenantClient(tenant.id);

        // Security check
        if (caller.role === UserRole.STUDENT) {
            const { data: stu } = await db.from('students').select('user_id').eq('id', studentId).maybeSingle();

            if (stu?.user_id !== caller.sub) {
                throw new ForbiddenException('Not allowed to access others report cards');
            }
        } else if (caller.role === UserRole.PARENT) {
            const { data: pc } = await db.from('parents').select('id').eq('user_id', caller.sub).eq('student_id', studentId).maybeSingle();
            if (!pc) {
                throw new ForbiddenException('Parent is not linked to this student');
            }
        }

        const { data: marks, error: marksError } = await db
            .from('student_marks')
            .select('*')
            .eq('student_id', studentId)
            .eq('term', String(term))
            .eq('academic_year', year);

        if (marksError) {
            this.logger.error(`Error gathering marks: ${marksError.message}`, marksError);
            throw new InternalServerErrorException('Error gathering marks');
        }

        const { data: student, error: studentError } = await db
            .from('students')
            .select('*, users(full_name)')
            .eq('id', studentId)
            .maybeSingle();

        if (studentError || !student) throw new NotFoundException('Student not found');

        // Check if term marks have been finalized
        let isFinalized = false;
        if (student.class_id) {
            const { data: finalization } = await db
                .from('term_finalizations')
                .select('is_finalized')
                .eq('tenant_id', tenant.id)
                .eq('class_id', student.class_id)
                .eq('academic_year', year)
                .eq('term', term)
                .maybeSingle();

            isFinalized = Boolean(finalization?.is_finalized);
        }

        return new Promise((resolve, reject) => {
            try {
                const PDFDoc = require('pdfkit');
                const doc = new PDFDoc({ margin: 50 });
                const buffers: Buffer[] = [];

                doc.on('data', (buf: Buffer) => buffers.push(buf));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                // Procedural School Banner & Crest Header Fallback
                const bannerX = 50;
                const bannerY = 40;
                const bannerWidth = 512;
                const bannerHeight = 65;

                // Navy header background
                doc.rect(bannerX, bannerY, bannerWidth, bannerHeight).fill('#1e3a8a');

                // Procedural gold/blue heraldic crest seal
                doc.circle(bannerX + 35, bannerY + 32, 22).lineWidth(1.5).stroke('#fbbf24');
                doc.circle(bannerX + 35, bannerY + 32, 18).fillAndStroke('#1e40af', '#f59e0b');
                doc.fontSize(10).fillColor('#fbbf24').text('★', bannerX + 31, bannerY + 26);

                // School Name & Subtitle
                doc.fontSize(15).fillColor('#ffffff').text(tenant.name || 'EduLanka Academy', bannerX + 70, bannerY + 16, { width: 420, ellipsis: true });
                doc.fontSize(8.5).fillColor('#93c5fd').text('OFFICIAL STUDENT TERMINAL PROGRESS REPORT', bannerX + 70, bannerY + 38);

                doc.fillColor('#000000');
                doc.y = bannerY + bannerHeight + 20;

                if (!isFinalized) {
                    doc.fontSize(12).fillColor('#dc2626').text('[ DRAFT REPORT CARD — TERM NOT FINALIZED ]', { align: 'center' });
                } else {
                    doc.fontSize(12).fillColor('#16a34a').text('[ OFFICIAL REPORT CARD — FINALIZED ]', { align: 'center' });
                }
                doc.fillColor('#000000');
                doc.moveDown();

                doc.fontSize(12).text(`Student Name: ${(student.users)?.full_name ?? 'Unknown'}`);
                doc.text(`Admission Number: ${student.admission_no}`);
                doc.text(`Academic Year: ${year}   |   Term: ${term}`);
                doc.text(`Status: ${isFinalized ? 'Certified / Finalized' : 'Draft / Unfinalized'}`);
                doc.moveDown();

                doc.text('-----------------------------------------------------------');
                doc.moveDown();

                if (marks && marks.length > 0) {
                    for (const mark of marks) {
                        const score = typeof mark.marks === 'number' ? mark.marks : (mark.total_score ?? '-');
                        doc.text(`${mark.subject.padEnd(40, ' ')} ${score}  ${mark.grade ? `(${mark.grade})` : ''}`);
                    }
                } else {
                    doc.text('No marks recorded for this term.');
                }

                doc.moveDown();
                doc.text('-----------------------------------------------------------');
                doc.moveDown();

                if (!isFinalized) {
                    doc.fontSize(9).fillColor('#dc2626').text(
                        '** DRAFT NOTICE: Terminal marks have not yet been finalized by school administration. Subject to change. **',
                        { align: 'center' }
                    );
                } else {
                    doc.fontSize(10).fillColor('#16a34a').text('** End of Official Certified Report **', { align: 'center' });
                }
                doc.fillColor('#000000');

                doc.end();
            } catch (error) {
                this.logger.error('Error generating PDF', error);
                reject(new InternalServerErrorException('Failed to generate PDF document'));
            }
        });
    }

    async queueBulkReportCardGeneration(dto: BulkReportCardsDto, caller: JwtPayload) {
        if (!caller.tenantId) {
            throw new BadRequestException('Tenant ID is required for bulk report card generation');
        }

        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN && caller.role !== UserRole.TEACHER) {
            throw new ForbiddenException('Only teachers and administrators can queue bulk report cards');
        }

        if (!this.bulkQueue) {
            throw new InternalServerErrorException('Bulk report cards queue is not initialized');
        }

        const job = await this.bulkQueue.add(
            'generate-bulk-report-cards',
            {
                tenantId: caller.tenantId,
                term: dto.term,
                academicYear: dto.academicYear,
                classId: dto.classId || null,
                triggeredBy: caller.sub,
            },
            {
                removeOnComplete: 100,
                removeOnFail: 50,
            },
        );

        return {
            success: true,
            jobId: job.id,
            status: 'QUEUED',
            message: `Bulk report card generation scheduled for Term ${dto.term}, ${dto.academicYear}`,
        };
    }

    async getBulkJobStatus(jobId: string, caller: JwtPayload) {
        if (!this.bulkQueue) {
            throw new InternalServerErrorException('Bulk report cards queue is not initialized');
        }

        const job = await this.bulkQueue.getJob(jobId);
        if (!job) {
            throw new NotFoundException(`Job ${jobId} not found`);
        }

        if (job.data?.tenantId !== caller.tenantId && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Cannot inspect bulk jobs of another tenant');
        }

        const state = await job.getState();
        return {
            jobId: job.id,
            state,
            progress: job.progress,
            data: {
                term: job.data.term,
                academicYear: job.data.academicYear,
                classId: job.data.classId,
            },
            result: job.returnvalue,
            failedReason: job.failedReason,
        };
    }
}
