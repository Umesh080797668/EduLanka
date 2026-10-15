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
import { randomUUID } from 'crypto';
import { SupabaseService, assertUuid } from '../supabase/supabase.service';
import type { RecordAttendanceDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
    private readonly logger = new Logger(AttendanceService.name);

    constructor(private readonly supabase: SupabaseService) { }

    private async getTeacherClassIds(caller: JwtPayload): Promise<string[]> {
        const { data: tRec } = await this.supabase.adminClient
            .from('teachers')
            .select('id')
            .eq('tenant_id', caller.tenantId)
            .eq('user_id', caller.sub)
            .maybeSingle();

        if (!tRec?.id) return [];

        const { data: ctRows } = await this.supabase.adminClient
            .from('class_teachers')
            .select('class_id')
            .eq('tenant_id', caller.tenantId)
            .eq('teacher_id', tRec.id);

        return (ctRows ?? []).map((ct: any) => ct.class_id).filter(Boolean);
    }

    private async assertClassAccess(caller: JwtPayload, classId: string) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(classId, 'classId');

        if (caller.role === UserRole.SUPER_ADMIN || caller.role === UserRole.SCHOOL_ADMIN) {
            return;
        }

        if (caller.role === UserRole.TEACHER) {
            const teacherClasses = await this.getTeacherClassIds(caller);
            if (!teacherClasses.includes(classId)) {
                throw new ForbiddenException('Teachers can only view or record attendance for their assigned classes');
            }
            return;
        }

        throw new ForbiddenException('Only teachers and administrators can access attendance');
    }

    /**
     * Retrieves attendance roster and recorded statuses for a class on a given date.
     */
    async getAttendance(caller: JwtPayload, classId: string, queryDate?: string) {
        await this.assertClassAccess(caller, classId);

        const date = queryDate || new Date().toISOString().slice(0, 10);
        const client = this.supabase.adminClient;

        // Fetch class info
        const { data: classData, error: classErr } = await client
            .from('classes')
            .select('id, name, grade')
            .eq('id', classId)
            .eq('tenant_id', caller.tenantId)
            .maybeSingle();

        if (classErr || !classData) {
            throw new NotFoundException(`Class ${classId} not found in this school`);
        }

        // Fetch enrolled students
        const { data: students, error: studErr } = await client
            .from('students')
            .select('id, user_id, admission_number, users!inner(id, full_name, email)')
            .eq('tenant_id', caller.tenantId)
            .eq('class_id', classId)
            .is('deleted_at', null)
            .order('admission_number', { ascending: true });

        if (studErr) {
            this.logger.error(`Failed to fetch students for class ${classId}: ${studErr.message}`);
            throw new InternalServerErrorException('Failed to retrieve student roster');
        }

        // Fetch recorded attendance for this date
        const { data: attendanceRecords, error: attErr } = await client
            .from('attendance')
            .select('id, student_id, status, marked_at, marked_by')
            .eq('tenant_id', caller.tenantId)
            .eq('class_id', classId)
            .eq('date', date)
            .is('deleted_at', null);

        if (attErr) {
            this.logger.error(`Failed to fetch attendance for class ${classId} on ${date}: ${attErr.message}`);
            throw new InternalServerErrorException('Failed to retrieve attendance records');
        }

        const attendanceMap = new Map<string, any>(
            (attendanceRecords ?? []).map((r: any) => [r.student_id, r]),
        );

        let present = 0;
        let absent = 0;
        let late = 0;
        let excused = 0;
        let unmarked = 0;

        const roster = (students ?? []).map((s: any) => {
            const user = s.users;
            const record = attendanceMap.get(user.id);
            const status = record?.status ?? null;

            if (status === 'PRESENT') present++;
            else if (status === 'ABSENT') absent++;
            else if (status === 'LATE') late++;
            else if (status === 'EXCUSED') excused++;
            else unmarked++;

            return {
                studentId: user.id, // users.id
                studentRecordId: s.id,
                admissionNumber: s.admission_number,
                fullName: user.full_name,
                email: user.email,
                status,
                markedAt: record?.marked_at ?? null,
                markedBy: record?.marked_by ?? null,
            };
        });

        const totalStudents = roster.length;
        const totalMarked = present + absent + late + excused;
        const attendanceRate = totalMarked > 0 ? Math.round(((present + late) / totalStudents) * 100) : 0;

        return {
            class: classData,
            date,
            summary: {
                totalStudents,
                totalMarked,
                present,
                absent,
                late,
                excused,
                unmarked,
                attendanceRate,
            },
            students: roster,
        };
    }

    /**
     * Records or updates roll call attendance for an entire class.
     */
    async recordAttendance(caller: JwtPayload, dto: RecordAttendanceDto) {
        await this.assertClassAccess(caller, dto.classId);

        if (!dto.records || dto.records.length === 0) {
            throw new BadRequestException('At least one student attendance record must be provided');
        }

        const client = this.supabase.adminClient;
        const nowIso = new Date().toISOString();

        const rows = dto.records.map((r) => ({
            tenant_id: caller.tenantId,
            class_id: dto.classId,
            student_id: r.studentId,
            date: dto.date,
            status: r.status,
            marked_at: nowIso,
            marked_by: caller.sub,
            updated_at: nowIso,
        }));

        const { data, error } = await client
            .from('attendance')
            .upsert(rows, { onConflict: 'tenant_id,class_id,student_id,date' })
            .select();

        if (error) {
            this.logger.error(`Failed to upsert attendance: ${error.message}`);
            throw new InternalServerErrorException('Failed to save attendance roll call');
        }

        // Emit sync events so offline mobile devices receive updated attendance
        for (const row of (data ?? [])) {
            try {
                await client.rpc('append_sync_event', {
                    p_tenant_id: caller.tenantId,
                    p_entity_type: 'attendance',
                    p_entity_id: row.id,
                    p_event_type: 'CREATED',
                    p_payload: row,
                    p_client_uuid: randomUUID(),
                });
            } catch (err: any) {
                this.logger.warn(`Failed to emit attendance sync event: ${err?.message}`);
            }
        }

        return {
            success: true,
            savedCount: data?.length || 0,
            date: dto.date,
            classId: dto.classId,
        };
    }

    /**
     * Aggregate attendance trends for reporting.
     */
    async getClassAttendanceStats(caller: JwtPayload, classId: string, startDate?: string, endDate?: string) {
        await this.assertClassAccess(caller, classId);

        const client = this.supabase.adminClient;
        let query = client
            .from('attendance')
            .select('date, status')
            .eq('tenant_id', caller.tenantId)
            .eq('class_id', classId)
            .is('deleted_at', null)
            .order('date', { ascending: true });

        if (startDate) query = query.gte('date', startDate);
        if (endDate) query = query.lte('date', endDate);

        const { data, error } = await query;
        if (error) {
            this.logger.error(`Failed to fetch stats: ${error.message}`);
            throw new InternalServerErrorException('Failed to calculate attendance statistics');
        }

        const dateMap = new Map<string, { present: number; absent: number; late: number; excused: number }>();
        for (const row of (data ?? [])) {
            const entry = dateMap.get(row.date) || { present: 0, absent: 0, late: 0, excused: 0 };
            if (row.status === 'PRESENT') entry.present++;
            else if (row.status === 'ABSENT') entry.absent++;
            else if (row.status === 'LATE') entry.late++;
            else if (row.status === 'EXCUSED') entry.excused++;
            dateMap.set(row.date, entry);
        }

        const dailyStats = Array.from(dateMap.entries()).map(([date, counts]) => ({
            date,
            ...counts,
            total: counts.present + counts.absent + counts.late + counts.excused,
        }));

        return {
            classId,
            totalDays: dailyStats.length,
            dailyStats,
        };
    }
}
