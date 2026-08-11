import { sleep } from 'k6';
import { get, safeJson } from './http.js';

/**
 * Student: highest-concurrency, read-only role in real usage (checking grades,
 * downloading report cards). Modeled as the biggest VU pool in full-system.js.
 */
export function studentFlow(data) {
    const session = data.studentSession;

    const meRes = get('/students/me', session, { name: 'student_get_self', expectedStatuses: [200, 404] });
    const me = safeJson(meRes);
    const studentId = me?.id || data.seedStudentId;
    sleep(0.3);

    if (studentId) {
        get(`/student-marks/student/${studentId}`, session, { name: 'student_get_marks', expectedStatuses: [200, 403, 404] });
        sleep(0.3);

        // Report card PDF generation/download — the heaviest single request in the
        // system (Sprint 4), worth isolating its own latency profile.
        const term = (Math.floor(Math.random() * 3) + 1);
        const year = new Date().getFullYear();
        get(`/report-cards/student/${studentId}/term/${term}/year/${year}/download`, session, {
            name: 'student_download_report_card',
            expectedStatuses: [200, 403, 404], // 404 acceptable if that term has no marks yet
        });
    }
    sleep(0.3);

    // First-run tutorial + dashboard help icon
    get('/tutorials/STUDENT/dashboard', session, { name: 'student_get_tutorial_dashboard' });
    get('/me/tutorials', session, { name: 'student_get_my_tutorial_status' });

    sleep(1 + Math.random() * 2);
}
