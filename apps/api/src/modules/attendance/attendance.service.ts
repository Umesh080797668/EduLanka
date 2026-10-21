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
     * Retrieves attendance roster and recorded statuses for a class on a given date and period.
     */
    async getAttendance(caller: JwtPayload, classId: string, queryDate?: string, queryPeriod: number = 1) {
        await this.assertClassAccess(caller, classId);

        const date = queryDate || new Date().toISOString().slice(0, 10);
        const period = queryPeriod ?? 1;
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
            .select('id, user_id, admission_no, users!inner(id, full_name, email)')
            .eq('tenant_id', caller.tenantId)
            .eq('class_id', classId)
            .order('admission_no', { ascending: true });

        if (studErr) {
            this.logger.error(`Failed to fetch students for class ${classId}: ${studErr.message}`);
            throw new InternalServerErrorException('Failed to retrieve student roster');
        }

        // Fetch recorded attendance for this date and period
        const { data: attendanceRecords, error: attErr } = await client
            .from('attendance')
            .select('id, student_id, status, period, marked_at, marked_by')
            .eq('tenant_id', caller.tenantId)
            .eq('class_id', classId)
            .eq('date', date)
            .eq('period', period)
            .is('deleted_at', null);

        if (attErr) {
            this.logger.error(`Failed to fetch attendance for class ${classId} on ${date} (period ${period}): ${attErr.message}`);
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
                admissionNumber: s.admission_no,
                fullName: user.full_name,
                email: user.email,
                status,
                period,
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
            period,
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
        const period = dto.period ?? 1;

        // Verify that all students in dto.records are enrolled in dto.classId
        const { data: enrolledStudents, error: studErr } = await client
            .from('students')
            .select('id, user_id')
            .eq('tenant_id', caller.tenantId)
            .eq('class_id', dto.classId);

        if (studErr) {
            this.logger.error(`Failed to verify enrolled students for class ${dto.classId}: ${studErr.message}`);
            throw new InternalServerErrorException('Failed to verify class enrollment');
        }

        // Map both user_id and student record id to user_id
        const userMap = new Map<string, string>();
        for (const s of enrolledStudents ?? []) {
            if (s.user_id) userMap.set(s.user_id, s.user_id);
            if (s.id && s.user_id) userMap.set(s.id, s.user_id);
        }

        const unassignedStudents = dto.records.filter((r) => !userMap.has(r.studentId));
        if (unassignedStudents.length > 0) {
            const invalidIds = unassignedStudents.map((r) => r.studentId).join(', ');
            throw new BadRequestException(
                `One or more students are not enrolled in class ${dto.classId}: ${invalidIds}`,
            );
        }

        const nowIso = new Date().toISOString();

        const rows = dto.records.map((r) => ({
            tenant_id: caller.tenantId,
            class_id: dto.classId,
            student_id: userMap.get(r.studentId) ?? r.studentId,
            date: dto.date,
            period,
            status: r.status,
            marked_at: nowIso,
            marked_by: caller.sub,
            updated_at: nowIso,
        }));

        // Check for conflicts with existing attendance records before upserting (ADR-002)
        const studentUserIds = rows.map((r) => r.student_id);
        const { data: existingRecords } = await client
            .from('attendance')
            .select('id, student_id, status, marked_at, period')
            .eq('tenant_id', caller.tenantId)
            .eq('class_id', dto.classId)
            .eq('date', dto.date)
            .eq('period', period)
            .in('student_id', studentUserIds);

        const existingMap = new Map<string, any>(
            (existingRecords ?? []).map((r: any) => [r.student_id, r]),
        );

        const conflictLogs = [];
        for (const r of rows) {
            const existing = existingMap.get(r.student_id);
            if (existing && existing.status !== r.status) {
                conflictLogs.push({
                    tenant_id: caller.tenantId,
                    class_id: dto.classId,
                    student_id: r.student_id,
                    conflict_date: dto.date,
                    period,
                    client_state: { status: r.status, marked_at: r.marked_at, period },
                    server_state: {
                        status: existing.status,
                        marked_at: existing.marked_at,
                        period: existing.period ?? period,
                    },
                    resolution: 'CLIENT_WINS',
                    resolved_by: caller.sub,
                });
            }
        }

        if (conflictLogs.length > 0) {
            this.logger.warn(
                `Detected and resolved ${conflictLogs.length} REST attendance conflict(s) for class ${dto.classId} on ${dto.date} (CLIENT_WINS)`,
            );
            const { error: logErr } = await client
                .from('attendance_conflicts_log')
                .insert(conflictLogs);
            if (logErr) {
                this.logger.warn(`Failed to log REST attendance conflicts: ${logErr.message}`);
            }
        }

        const { data, error } = await client
            .from('attendance')
            .upsert(rows, { onConflict: 'tenant_id,class_id,student_id,date,period' })
            .select();

        if (error) {
            this.logger.error(`Failed to upsert attendance: ${error.message}`);
            throw new InternalServerErrorException('Failed to save attendance roll call');
        }

        // Emit sync events concurrently so offline mobile devices receive updated attendance
        const syncPromises = (data ?? []).map(async (row: any) => {
            const { error: syncErr } = await client.rpc('append_sync_event', {
                p_tenant_id: caller.tenantId,
                p_entity_type: 'attendance',
                p_entity_id: row.id,
                p_event_type: 'CREATED',
                p_payload: {
                    ...row,
                    period: row.period ?? period,
                },
                p_client_uuid: randomUUID(),
            });
            if (syncErr) {
                this.logger.warn(`Failed to emit attendance sync event for row ${row.id}: ${syncErr.message}`);
            }
        });
        await Promise.allSettled(syncPromises);

        return {
            success: true,
            savedCount: data?.length || 0,
            date: dto.date,
            period,
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

    /**
     * Retrieve attendance records for the currently authenticated student.
     */
    async getMyAttendance(caller: JwtPayload, startDate?: string, endDate?: string) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        const client = this.supabase.adminClient;

        // Fetch student profile linked to caller
        const { data: student } = await client
            .from('students')
            .select('id, user_id, admission_no, class_id, classes(id, name, grade)')
            .eq('tenant_id', caller.tenantId)
            .eq('user_id', caller.sub)
            .maybeSingle();

        const studentIdCandidates = [caller.sub];
        if (student?.id) {
            studentIdCandidates.push(student.id);
        }

        let query = client
            .from('attendance')
            .select('id, student_id, class_id, date, period, status, marked_at, classes(id, name, grade)')
            .eq('tenant_id', caller.tenantId)
            .in('student_id', studentIdCandidates)
            .is('deleted_at', null)
            .order('date', { ascending: false })
            .order('period', { ascending: false });

        if (startDate) query = query.gte('date', startDate);
        if (endDate) query = query.lte('date', endDate);

        const { data, error } = await query;
        if (error) {
            this.logger.error(`Failed to fetch student attendance: ${error.message}`);
            throw new InternalServerErrorException('Failed to retrieve student attendance history');
        }

        const records = data ?? [];
        const summary = {
            total: records.length,
            present: records.filter((r) => r.status === 'PRESENT').length,
            absent: records.filter((r) => r.status === 'ABSENT').length,
            late: records.filter((r) => r.status === 'LATE').length,
            excused: records.filter((r) => r.status === 'EXCUSED').length,
            attendancePercentage: records.length > 0
                ? Math.round(
                    ((records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length) /
                        records.length) *
                    100,
                )
                : 100,
        };

        return {
            student: student ?? { user_id: caller.sub },
            records,
            summary,
        };
    }

    /**
     * Retrieve attendance records for a specific student (Accessible by Admins, assigned Teachers, and Parents of the student).
     */
    async getStudentAttendance(
        caller: JwtPayload,
        studentId: string,
        startDate?: string,
        endDate?: string,
    ) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(studentId, 'studentId');

        const client = this.supabase.adminClient;

        // Fetch student entity
        const { data: student, error: studentErr } = await client
            .from('students')
            .select('id, user_id, admission_no, class_id, users!inner(full_name, email), classes(id, name, grade)')
            .eq('tenant_id', caller.tenantId)
            .or(`id.eq.${studentId},user_id.eq.${studentId}`)
            .maybeSingle();

        if (studentErr || !student) {
            throw new NotFoundException(`Student ${studentId} not found in this school`);
        }

        // Authorization check
        if (
            caller.role === UserRole.SUPER_ADMIN ||
            caller.role === UserRole.SCHOOL_ADMIN
        ) {
            // Full administrative access allowed
        } else if (caller.role === UserRole.TEACHER) {
            const teacherClasses = await this.getTeacherClassIds(caller);
            if (!student.class_id || !teacherClasses.includes(student.class_id)) {
                throw new ForbiddenException('Teachers can only view attendance for students in their assigned classes');
            }
        } else if (caller.role === UserRole.PARENT) {
            const { data: link } = await client
                .from('parents')
                .select('id')
                .eq('tenant_id', caller.tenantId)
                .eq('user_id', caller.sub)
                .eq('student_id', student.id)
                .maybeSingle();

            if (!link) {
                throw new ForbiddenException('Parents can only view attendance for their linked children');
            }
        } else if (caller.role === UserRole.STUDENT) {
            if (student.user_id !== caller.sub && student.id !== caller.sub) {
                throw new ForbiddenException('Students can only view their own attendance');
            }
        } else {
            throw new ForbiddenException('Unauthorized to view attendance');
        }

        const studentIdCandidates = [student.id, student.user_id].filter(Boolean);

        let query = client
            .from('attendance')
            .select('id, student_id, class_id, date, period, status, marked_at, classes(id, name, grade)')
            .eq('tenant_id', caller.tenantId)
            .in('student_id', studentIdCandidates)
            .is('deleted_at', null)
            .order('date', { ascending: false })
            .order('period', { ascending: false });

        if (startDate) query = query.gte('date', startDate);
        if (endDate) query = query.lte('date', endDate);

        const { data, error } = await query;
        if (error) {
            this.logger.error(`Failed to fetch student attendance: ${error.message}`);
            throw new InternalServerErrorException('Failed to retrieve student attendance history');
        }

        const records = data ?? [];
        const summary = {
            total: records.length,
            present: records.filter((r) => r.status === 'PRESENT').length,
            absent: records.filter((r) => r.status === 'ABSENT').length,
            late: records.filter((r) => r.status === 'LATE').length,
            excused: records.filter((r) => r.status === 'EXCUSED').length,
            attendancePercentage: records.length > 0
                ? Math.round(
                    ((records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length) /
                        records.length) *
                    100,
                )
                : 100,
        };

        return {
            student,
            records,
            summary,
        };
    }
}
