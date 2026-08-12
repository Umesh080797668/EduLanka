import { apiClient } from '../api-client';
import type {
    ClassProfile,
    StudentProfile,
    TeacherProfile,
    ParentProfile,
    SchoolPolicy,
    SubjectArea,
    ALStream,
    Gender,
    ParentRelationship,
    InstructionMedium,
    GradeProfile,
} from '@edu-lanka/shared-types';

export interface RequestOpts {
    token: string;
    tenantId: string;
}

// -----------------------------------------------------------------------------
// Classes
// -----------------------------------------------------------------------------
export const fetchClasses = (opts: RequestOpts) =>
    apiClient.get<ClassProfile[]>('/classes', opts);

export const fetchClass = (id: string, opts: RequestOpts) =>
    apiClient.get<ClassProfile>(`/classes/${id}`, opts);

export const createClass = (data: { gradeId: string; section: string; year: number; medium?: InstructionMedium }, opts: RequestOpts) =>
    apiClient.post<ClassProfile>('/classes', data, opts);

export const updateClass = (id: string, data: { section?: string; year?: number }, opts: RequestOpts) =>
    apiClient.patch<ClassProfile>(`/classes/${id}`, data, opts);

export const assignTeacherToClass = (classId: string, data: { teacherId: string; isHomeroom?: boolean; subject?: SubjectArea }, opts: RequestOpts) =>
    apiClient.post(`/classes/${classId}/assign-teacher`, data, opts);

export const removeTeacherFromClass = (classId: string, teacherId: string, opts: RequestOpts) =>
    apiClient.delete(`/classes/${classId}/teachers/${teacherId}`, opts);

// -----------------------------------------------------------------------------
// Students
// -----------------------------------------------------------------------------
export const fetchStudents = (opts: RequestOpts) =>
    apiClient.get<StudentProfile[]>('/students', opts);

export const fetchStudent = (id: string, opts: RequestOpts) =>
    apiClient.get<StudentProfile>(`/students/${id}`, opts);

export const enrollStudent = (data: {
    fullName: string;
    email: string;
    temporaryPassword?: string;
    phoneNumber?: string;
    admissionNo?: string;
    dateOfBirth?: string;
    gender?: Gender;
    classId?: string;
    alStream?: ALStream;
    medium?: InstructionMedium;
}, opts: RequestOpts) =>
    apiClient.post<StudentProfile>('/students', {
        ...data,
        temporaryPassword: data.temporaryPassword || 'TempPass2026!'
    }, opts);

export const assignClassToStudent = (studentId: string, classId: string, opts: RequestOpts) =>
    apiClient.post<StudentProfile>(`/students/${studentId}/assign-class`, { classId }, opts);

export const updateStudent = (id: string, data: any, opts: RequestOpts) =>
    apiClient.patch<StudentProfile>(`/students/${id}`, data, opts);

// -----------------------------------------------------------------------------
// Teachers
// -----------------------------------------------------------------------------
export const fetchTeachers = (opts: RequestOpts) =>
    apiClient.get<TeacherProfile[]>('/teachers', opts);

export const fetchTeacher = (id: string, opts: RequestOpts) =>
    apiClient.get<TeacherProfile>(`/teachers/${id}`, opts);

export const createTeacher = (data: any, opts: RequestOpts) =>
    apiClient.post<TeacherProfile>('/teachers', {
        ...data,
        temporaryPassword: data.temporaryPassword || 'TempPass2026!'
    }, opts);

export const updateTeacher = (id: string, data: any, opts: RequestOpts) =>
    apiClient.patch<TeacherProfile>(`/teachers/${id}`, data, opts);

// -----------------------------------------------------------------------------
// Parents
// -----------------------------------------------------------------------------
export const fetchParents = (opts: RequestOpts) =>
    apiClient.get<ParentProfile[]>('/parents', opts);

export const fetchParent = (id: string, opts: RequestOpts) =>
    apiClient.get<ParentProfile>(`/parents/${id}`, opts);

export const linkStudentToParent = (parentId: string, data: { studentId: string; relationship: ParentRelationship }, opts: RequestOpts) =>
    apiClient.post(`/parents/${parentId}/link-student`, data, opts);

export const unlinkStudentFromParent = (parentId: string, studentId: string, opts: RequestOpts) =>
    apiClient.delete(`/parents/${parentId}/students/${studentId}`, opts);

// -----------------------------------------------------------------------------
// Users
// -----------------------------------------------------------------------------
export const fetchUsers = (role: string | undefined, opts: RequestOpts) =>
    apiClient.get<any[]>(`/users${role ? `?role=${role}` : ''}`, opts);

export const fetchGlobalUsers = (opts: RequestOpts) =>
    apiClient.get<any[]>('/users/global-directory', opts);

export const toggleTenantSms = (tenantId: string, opts: RequestOpts) =>
    apiClient.patch(`/users/global-directory/tenant/${tenantId}/sms`, {}, opts);

export const createUser = (data: any, opts: RequestOpts) =>
    apiClient.post<any>('/users', data, opts);

export const updateUser = (id: string, data: any, opts: RequestOpts) =>
    apiClient.patch<any>(`/users/${id}`, data, opts);

export const setUserActive = (id: string, active: boolean, opts: RequestOpts) =>
    apiClient.patch<any>(`/users/${id}/${active ? 'reactivate' : 'deactivate'}`, {}, opts);

// -----------------------------------------------------------------------------
// School Policy
// -----------------------------------------------------------------------------
export const fetchPolicy = (opts: RequestOpts) =>
    apiClient.get<SchoolPolicy>('/school-policy', opts);

export const updatePolicy = (data: any, opts: RequestOpts) =>
    apiClient.patch<SchoolPolicy>('/school-policy', data, opts);

// -----------------------------------------------------------------------------
// Grades
// -----------------------------------------------------------------------------
export const fetchGrades = (opts: RequestOpts) =>
    apiClient.get<GradeProfile[]>('/grades', opts);

export const createGrade = (data: any, opts: RequestOpts) =>
    apiClient.post<GradeProfile>('/grades', data, opts);

export const updateGrade = (id: string, data: any, opts: RequestOpts) =>
    apiClient.patch<GradeProfile>(`/grades/${id}`, data, opts);

export const deleteGrade = (id: string, opts: RequestOpts) =>
    apiClient.delete(`/grades/${id}`, opts);
