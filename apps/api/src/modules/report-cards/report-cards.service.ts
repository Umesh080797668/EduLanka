import { Injectable, Logger, InternalServerErrorException, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { SupabaseService } from '../supabase/supabase.service';
import { TenantService } from '../tenant/tenant.service';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ReportCardsService {
    private readonly logger = new Logger(ReportCardsService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly tenantService: TenantService,
    ) { }

    async generateReportCard(studentId: string, term: number, year: number, caller: JwtPayload): Promise<Buffer> {
        const tenant = await this.tenantService.findOneById(caller.tenantId, caller);
        const db = this.supabase.getTenantClient(tenant.slug);

        // Security check
        if (caller.role === UserRole.STUDENT) {
            const { data: stu } = await db.from('students').select('users!inner(user_id)').eq('id', studentId).maybeSingle();
            const userRef = (stu as any)?.users;
            const actualSub = Array.isArray(userRef) ? userRef[0]?.user_id : userRef?.user_id;

            if (actualSub !== caller.sub) {
                throw new ForbiddenException('Not allowed to access others report cards');
            }
        } else if (caller.role === UserRole.PARENT) {
            const { data: pa } = await db.from('users').select('id').eq('user_id', caller.sub).maybeSingle();
            const { data: pc } = await db.from('parent_children').select('id').eq('parent_user_id', pa?.id).eq('student_id', studentId).maybeSingle();
            if (!pc) {
                throw new ForbiddenException('Not allowed to access others report cards');
            }
        }

        const { data: marks, error: marksError } = await db
            .from('student_marks')
            .select('*')
            .eq('student_id', studentId)
            .eq('term', term)
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

        return new Promise((resolve, reject) => {
            try {
                const doc = new (PDFDocument as any)({ margin: 50 });
                const buffers: Buffer[] = [];

                doc.on('data', (buf: Buffer) => buffers.push(buf));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                doc.fontSize(20).text(`EduLanka Report Card - ${tenant.name}`, { align: 'center' });
                doc.moveDown();

                doc.fontSize(12).text(`Student Name: ${(student.users as any)?.full_name ?? 'Unknown'}`);
                doc.text(`Admission Number: ${student.admission_no}`);
                doc.text(`Academic Year: ${year}   |   Term: ${term}`);
                doc.moveDown();

                doc.text('-----------------------------------------------------------');
                doc.moveDown();

                if (marks && marks.length > 0) {
                    for (const mark of marks) {
                        doc.text(`${mark.subject.padEnd(40, ' ')} ${mark.marks}`);
                    }
                } else {
                    doc.text('No marks recorded for this term.');
                }

                doc.moveDown();
                doc.text('-----------------------------------------------------------');
                doc.moveDown();
                doc.fontSize(10).text('** End of Official Report **', { align: 'center' });

                doc.end();
            } catch (error) {
                this.logger.error('Error generating PDF', error);
                reject(new InternalServerErrorException('Failed to generate PDF document'));
            }
        });
    }
}
