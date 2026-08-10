import { UserRole } from '../auth.types';
import { Gender, InstructionMedium, Grade, ALStream } from '../student.types';
import { SubjectArea } from '../teacher.types';
import { TenantPlan, TenantStatus, SchoolType } from '../tenant.types';

describe('Shared Types Enums', () => {
    describe('auth.types.ts', () => {
        it('UserRole has all expected roles', () => {
            const roles = Object.values(UserRole);
            expect(roles).toEqual(expect.arrayContaining([
                'STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_ADMIN',
                'ZONAL_OFFICER', 'MOE_OFFICER', 'SUPER_ADMIN'
            ]));
            expect(roles.length).toBe(7);
        });
    });

    describe('student.types.ts', () => {
        it('Gender includes core definitions', () => {
            expect(Object.values(Gender)).toEqual(['MALE', 'FEMALE', 'OTHER']);
        });

        it('InstructionMedium includes local languages and English', () => {
            expect(Object.values(InstructionMedium)).toEqual(['ENGLISH', 'SINHALA', 'TAMIL']);
        });

        it('Grade scales from 1 to 13 according to SL curriculum', () => {
            expect(Grade.GRADE_1).toBe('GRADE_1');
            expect(Grade.GRADE_13).toBe('GRADE_13');
            expect(Object.values(Grade).length).toBe(13);
        });

        it('ALStream has essential national streams', () => {
            const streams = Object.values(ALStream);
            expect(streams).toContain('SCIENCE');
            expect(streams).toContain('COMMERCE');
            expect(streams).toContain('ARTS');
            expect(streams).toContain('TECHNOLOGY');
        });
    });

    describe('teacher.types.ts', () => {
        it('SubjectArea contains extensive national curriculum subjects', () => {
            const subjects = Object.values(SubjectArea);
            expect(subjects).toContain('SINHALA');
            expect(subjects).toContain('TAMIL');
            expect(subjects).toContain('ENGLISH');
            expect(subjects).toContain('COMBINED_MATHS');
            expect(subjects).toContain('ICT');
            expect(subjects).toContain('BUSINESS_ACCOUNTING');
            expect(subjects.length).toBeGreaterThan(40);
        });
    });

    describe('tenant.types.ts', () => {
        it('TenantPlan handles Free and Pro tiers', () => {
            expect(Object.values(TenantPlan)).toEqual(['FREE', 'PRO']);
        });

        it('TenantStatus has valid application lifecycle states', () => {
            expect(Object.values(TenantStatus)).toEqual(['ACTIVE', 'SUSPENDED', 'PROVISIONING', 'DEPROVISIONED']);
        });

        it('SchoolType maps to MoE categories', () => {
            expect(Object.values(SchoolType)).toEqual(['TYPE_1AB', 'TYPE_1C', 'TYPE_2', 'TYPE_3', 'PRIVATE']);
        });
    });
});
