import { sleep } from 'k6';
import { get, safeJson } from './http.js';

/**
 * Parent: reads their own profile, the linked-children list, then drills into
 * one child's marks/report card — the one-to-many relationship added in Sprint 3.
 */
export function parentFlow(data) {
    const session = data.parentSession;

    const meRes = get('/parents/me', session, { name: 'parent_get_self', expectedStatuses: [200, 404] });
    const me = safeJson(meRes);
    const parentId = me?.id;
    sleep(0.3);

    let childId = data.seedStudentId;
    if (parentId) {
        const childrenRes = get(`/parents/${parentId}/children`, session, {
            name: 'parent_list_children',
            expectedStatuses: [200, 404],
        });
        const children = safeJson(childrenRes);
        if (Array.isArray(children) && children[0]?.id) childId = children[0].id;
    }
    sleep(0.3);

    if (childId) {
        get(`/student-marks/student/${childId}`, session, { name: 'parent_get_child_marks', expectedStatuses: [200, 403, 404] });

        const term = (Math.floor(Math.random() * 3) + 1);
        const year = new Date().getFullYear();
        get(`/report-cards/student/${childId}/term/${term}/year/${year}/download`, session, {
            name: 'parent_download_report_card',
            expectedStatuses: [200, 403, 404],
        });
    }
    sleep(0.3);

    get('/tutorials/PARENT/grades', session, { name: 'parent_get_tutorial' });

    sleep(1 + Math.random() * 2);
}
