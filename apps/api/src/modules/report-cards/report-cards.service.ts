import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '@edu-lanka/shared-types';
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
        const db = this.supabase.getTenantClient(tenant.slug);

        // Fetch student's marks
        const { data: marks, error: marksError } = await db
            .from('student_marks')
            .select('*')
            .eq('student_id', studentId)
            .eq('term', term)
            .eq('academic_year', year);

        if (marksError) {
            this.logger.error(`Error fetching marks for report card: ${marksError.message}`);
            throw new InternalServerErrorException('Error gathering marks for report card');
        }

        const { data: student, error: studentError } = await db
            .from('students')
            .select('*, users(full_name)')
            .eq('id', studentId)
            .maybeSingle();

        if (studentError || !student) {
            throw new NotFoundException('Student not found');
        }

        // Simulate PDF generation by creating a beautifully structured readable buffer for the frontend.
        // In a real production scenario, we would use pdfkit to build a PDF buffer here.
        // Returning a generic string format representing the report card bytes.
        let reportText = `EduLanka Report Card - ${tenant.name}\n`;
        reportText += `==============================================\n`;
        reportText += `Student: ${student.users?.full_name ?? 'Unknown'} (Admission: ${student.admission_no})\n`;
        reportText += `Academic Year: ${year} | Term: ${term}\n\n`;
        reportText += `Subject |\t\tMarks\n`;
        reportText += `----------------------------------------------\n`;

        marks?.forEach(mark => {
            reportText += `${mark.subject.padEnd(20, ' ')} |\t\t${mark.marks}\n`;
        });

        reportText += `\n** End of Report **\n`;

        return Buffer.from(reportText, 'utf-8');
    }
}
