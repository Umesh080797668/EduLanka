import { sleep } from 'k6';
import { get, post, patch, safeJson } from './http.js';

/**
 * School Admin: the write-heaviest role. Creates a grade/class/teacher/student,
 * links them together, reads back rosters, and tweaks school policy —
 * mirroring the Sprint 3/4 admin workflows end to end.
 * `data.adminSession` is provided by setup() in full-system.js.
 */
export function schoolAdminFlow(data) {
    const session = data.adminSession;
    const uniq = `${__VU}-${__ITER}-${Date.now()}`;

    // Read-heavy: dashboards poll these constantly
    get('/students', session, { name: 'admin_list_students' });
    get('/teachers', session, { name: 'admin_list_teachers' });
    get('/parents', session, { name: 'admin_list_parents' });
    get('/classes', session, { name: 'admin_list_classes' });
    get('/school-policy', session, { name: 'admin_get_policy', expectedStatuses: [200, 403, 404] });
    get('/notices/maintenance/active', session, { name: 'admin_active_maintenance', expectedStatuses: [200, 403, 404] });
    get('/tenants/disaster-mode/history', session, { name: 'admin_disaster_history', expectedStatuses: [200, 403, 404] });
    sleep(0.5);

    // Write path: create a class for this iteration
    const classRes = post('/classes', session, {
        gradeId: data.seedGradeId,
        section: `LT-${uniq}`.slice(0, 10),
        year: new Date().getFullYear(),
    }, { name: 'admin_create_class', expectedStatuses: [201, 400, 409] });
    const classId = safeJson(classRes)?.id;
    sleep(0.3);

    // Write path: create a teacher
    const teacherRes = post('/teachers', session, {
        fullName: `LoadTest Teacher ${uniq}`,
        email: `lt.teacher.${uniq}@loadtest.edulanka.lk`,
        temporaryPassword: 'LoadTest123!',
    }, { name: 'admin_create_teacher', expectedStatuses: [201, 400, 409] });
    const teacherId = safeJson(teacherRes)?.id;
    sleep(0.3);

    // Write path: create a student
    const studentRes = post('/students', session, {
        fullName: `LoadTest Student ${uniq}`,
        admissionNo: `LT/${uniq}`.slice(0, 20),
        classId: classId || undefined,
        temporaryPassword: 'LoadTest123!',
    }, { name: 'admin_create_student', expectedStatuses: [201, 400, 409] });
    const studentId = safeJson(studentRes)?.id;
    sleep(0.3);

    // Link teacher to the class just created (homeroom assignment)
    if (classId && teacherId) {
        post(`/classes/${classId}/assign-teacher`, session, {
            teacherId,
            isHomeroom: true,
        }, { name: 'admin_assign_teacher', expectedStatuses: [200, 201, 400, 404] });
    }
    sleep(0.3);

    // Policy update — low frequency in real life, still exercised here
    if (Math.random() < 0.1) {
        patch('/school-policy', session, {
            maxStudentsPerClass: 35 + Math.floor(Math.random() * 5),
        }, { name: 'admin_update_policy', expectedStatuses: [200, 400, 403, 404, 500] });
    }

    // Tutorial completion stats — Sprint 6 admin dashboard widget
    get('/institution-admin/tutorials/stats', session, { name: 'admin_tutorial_stats', expectedStatuses: [200, 403, 404, 500] });

    // Disaster Mode drill — low frequency admin action
    if (Math.random() < 0.05) {
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const activateRes = post('/tenants/disaster-mode/activate', session, {
            reason: 'FLOOD',
            details: 'Automated k6 resilience drill',
            resumeDate: tomorrow,
        }, { name: 'admin_disaster_activate', expectedStatuses: [200, 201, 400, 403, 409] });

        if (activateRes && (activateRes.status === 200 || activateRes.status === 201)) {
            sleep(0.3);
            post('/tenants/disaster-mode/deactivate', session, {
                note: 'Drill concluded by runner',
            }, { name: 'admin_disaster_deactivate', expectedStatuses: [200, 201, 400, 403, 409] });
        }
    }

    sleep(1 + Math.random());
}
