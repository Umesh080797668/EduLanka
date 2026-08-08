'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function TeacherGradesPage() {
    const params = useParams();
    const classId = params.classId as string;

    const [students, setStudents] = useState<any[]>([]);
    const [marks, setMarks] = useState<Record<string, number>>({});
    const [subject, setSubject] = useState('MATHEMATICS');
    const [term, setTerm] = useState(1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [statusText, setStatusText] = useState('');

    useEffect(() => {
        // Mock data fetch for students in this class.
        // In reality, this would hit GET /api/v1/classes/${classId}/students
        setStudents([
            { id: 'bbbbbbbb-1111-2222-3333-aaaaaaaaaaaa', admissionNo: 'STU-001', name: 'John Doe' },
            { id: 'cccccccc-1111-2222-3333-aaaaaaaaaaaa', admissionNo: 'STU-002', name: 'Jane Smith' },
        ]);

        // Load existing marks...
        fetchMarks();
    }, [classId, subject, term, year]);

    const fetchMarks = async () => {
        try {
            // GET /api/v1/student-marks/class/{classId}?term=1&year=2026
            const res = await fetch(`/api/v1/student-marks/class/${classId}?term=${term}&year=${year}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                const newMarks: Record<string, number> = {};
                data.data?.forEach((m: any) => {
                    newMarks[m.student_id] = m.marks;
                });
                setMarks(newMarks);
            }
        } catch (e) {
            console.error("Failed to fetch marks", e);
        }
    };

    const handleSave = async (studentId: string, markValue: number) => {
        setStatusText(`Saving mark for ${studentId}...`);
        try {
            const res = await fetch('/api/v1/student-marks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    studentId,
                    classId,
                    subject,
                    term,
                    academicYear: year,
                    marks: markValue
                })
            });
            if (res.ok) {
                setStatusText('Saved successfully.');
            } else {
                setStatusText('Failed to save.');
            }
        } catch (e) {
            setStatusText('Error saving.');
        }

        // Hide status after 2 seconds
        setTimeout(() => setStatusText(''), 2000);
    };

    return (
        <div>
            <h2>Grade Entry for Class: {classId}</h2>

            <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <label>
                    Subject:
                    <select value={subject} onChange={e => setSubject(e.target.value)} style={{ marginLeft: '.5rem', padding: '4px' }}>
                        <option value="MATHEMATICS">Mathematics</option>
                        <option value="SCIENCE">Science</option>
                        <option value="ENGLISH">English</option>
                        <option value="SINHALA">Sinhala</option>
                    </select>
                </label>
                <label>
                    Term:
                    <select value={term} onChange={e => setTerm(Number(e.target.value))} style={{ marginLeft: '.5rem', padding: '4px' }}>
                        <option value={1}>Term 1</option>
                        <option value={2}>Term 2</option>
                        <option value={3}>Term 3</option>
                    </select>
                </label>
                <label>
                    Year:
                    <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ marginLeft: '.5rem', padding: '4px', width: '80px' }} />
                </label>
            </div>

            {statusText && <div style={{ marginBottom: '1rem', color: 'green', fontWeight: 'bold' }}>{statusText}</div>}

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                    <tr style={{ background: '#eee', textAlign: 'left' }}>
                        <th style={{ padding: '8px', border: '1px solid #ccc' }}>Admission No</th>
                        <th style={{ padding: '8px', border: '1px solid #ccc' }}>Student Name</th>
                        <th style={{ padding: '8px', border: '1px solid #ccc' }}>Marks</th>
                        <th style={{ padding: '8px', border: '1px solid #ccc' }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map(s => (
                        <tr key={s.id}>
                            <td style={{ padding: '8px', border: '1px solid #ccc' }}>{s.admissionNo}</td>
                            <td style={{ padding: '8px', border: '1px solid #ccc' }}>{s.name}</td>
                            <td style={{ padding: '8px', border: '1px solid #ccc' }}>
                                <input
                                    type="number"
                                    min="0" max="100"
                                    value={marks[s.id] ?? ''}
                                    onChange={e => setMarks({ ...marks, [s.id]: Number(e.target.value) })}
                                    style={{ width: '60px', padding: '4px' }}
                                />
                            </td>
                            <td style={{ padding: '8px', border: '1px solid #ccc' }}>
                                <button
                                    onClick={() => handleSave(s.id, marks[s.id])}
                                    style={{ padding: '4px 12px', background: 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Save
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

