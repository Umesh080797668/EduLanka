import { sleep } from 'k6';
import { get, post, safeJson } from './http.js';

/**
 * Teacher: moderate read (roster, classes) + steady write (marks entry).
 * `data.teacherSession` / `data.seedStudentId` / `data.seedClassId` come from setup().
 */
export function teacherFlow(data) {
    const session = data.teacherSession;

    const classesRes = get('/classes', session, { name: 'teacher_list_classes' });
    const classes = safeJson(classesRes);
    const classId = (Array.isArray(classes) && classes[0]?.id) || data.seedClassId;
    sleep(0.4);

    if (data.seedTeacherId) {
        get(`/teachers/${data.seedTeacherId}/classes`, session, {
            name: 'teacher_get_my_classes',
            expectedStatuses: [200, 404],
        });
    }
    if (classId) {
        get(`/student-marks/class/${classId}`, session, { name: 'teacher_list_class_marks' });
    }
    sleep(0.4);

    // Grade entry — the core Sprint 4 write path
    if (data.seedStudentId && classId) {
        post('/student-marks', session, {
            studentId: data.seedStudentId,
            classId,
            subject: ['Mathematics', 'Science', 'English', 'Sinhala', 'History'][Math.floor(Math.random() * 5)],
            term: (Math.floor(Math.random() * 3) + 1),
            academicYear: new Date().getFullYear(),
            marks: Math.floor(Math.random() * 101),
        }, { name: 'teacher_submit_marks', expectedStatuses: [200, 201, 400, 409] });
    }
    sleep(0.4);

    // Tutorial content for the grades screen
    get('/tutorials/TEACHER/grades', session, { name: 'teacher_get_tutorial' });

    sleep(1 + Math.random() * 1.5);
}
