export interface StudentMark {
    id: string;
    student_id: string;
    class_id: string;
    subject: string;
    term: number;
    academic_year: number;
    marks: number;
    teacher_id?: string;
    created_at: string;
    updated_at: string;
}
