import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { Injectable, Logger, InternalServerErrorException, NotFoundException, ForbiddenException } from '@nestjs/common';

import { SupabaseService } from '../supabase/supabase.service';
import { TenantService } from '../tenant/tenant.service';


@Injectable()
export class ReportCardsService {
    private readonly logger = new Logger(ReportCardsService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly tenantService: TenantService,
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

                doc.fontSize(20).text(`EduLanka Report Card - ${tenant.name}`, { align: 'center' });
                doc.moveDown(0.5);

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
}
