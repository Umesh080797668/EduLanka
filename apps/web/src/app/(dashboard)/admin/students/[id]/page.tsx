'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchStudent, fetchClasses, assignClassToStudent, RequestOpts } from '@/lib/api/school';
import type { StudentProfile, ClassProfile } from '@edu-lanka/shared-types';

export default function StudentDetailPage() {
    const params = useParams();
    const id = params?.id as string;

    const [student, setStudent] = useState<StudentProfile | null>(null);
    const [classes, setClasses] = useState<ClassProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Class assignment state
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [assigningClass, setAssigningClass] = useState(false);

    useEffect(() => {
        if (!id) return;
        const opts: RequestOpts = { token: 'DEMO', tenantId: 'DEMO' };

        Promise.all([
            fetchStudent(id, opts),
            fetchClasses(opts)
        ])
            .then(([studentData, classesData]) => {
                setStudent(studentData);
                setClasses(classesData);
                if (studentData.class_id) {
                    setSelectedClassId(studentData.class_id);
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    const handleAssignClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClassId) return;

        setAssigningClass(true);
        const opts: RequestOpts = { token: 'DEMO', tenantId: 'DEMO' };
        try {
            const updated = await assignClassToStudent(id, selectedClassId, opts);
            setStudent(updated);
            alert('Class assigned successfully');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setAssigningClass(false);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading student...</div>;
    if (error) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{error}</div>;
    if (!student) return <div style={{ padding: '2rem' }}>Student not found.</div>;

    return (
        <div style={{ maxWidth: '800px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href="/admin/students" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
                    &larr; Back to Students
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{student.users?.full_name}</h1>
                    <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: student.users?.is_active ? '#dcfce7' : '#fee2e2',
                        color: student.users?.is_active ? '#166534' : '#991b1b'
                    }}>
                        {student.users?.is_active ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Profile Card */}
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                        Profile Information
                    </h2>
                    <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem' }}>
                        <div>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Admission Number</span>
                            <span style={{ fontWeight: 500 }}>{student.admission_no}</span>
                        </div>
                        <div>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Email</span>
                            <span style={{ fontWeight: 500 }}>{student.users?.email}</span>
                        </div>
                        <div>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Phone</span>
                            <span style={{ fontWeight: 500 }}>{student.users?.phone_number || 'None'}</span>
                        </div>
                        <div>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Date of Birth</span>
                            <span style={{ fontWeight: 500 }}>{student.date_of_birth || 'Not specified'}</span>
                        </div>
                        <div>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Gender</span>
                            <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{student.gender || 'Not specified'}</span>
                        </div>
                    </div>
                </div>

                {/* Class Assignment Card */}
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                        Class Assignment
                    </h2>

                    {student.classes && (
                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Currently assigned to:</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{(student.classes.grade as any)?.name ?? `Grade ${student.classes.grade}`}-{student.classes.section}</div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Year {student.classes.year}</div>
                        </div>
                    )}

                    <form onSubmit={handleAssignClass}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                            Change Class
                        </label>
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', marginBottom: '1rem' }}
                        >
                            <option value="">-- No Class Selected --</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>
                                    {(cls.grade as any)?.name ?? `Grade ${cls.grade}`}-{cls.section} ({cls.year})
                                </option>
                            ))}
                        </select>
                        <button
                            type="submit"
                            disabled={assigningClass || !selectedClassId || selectedClassId === student.class_id}
                            style={{
                                width: '100%',
                                background: 'var(--color-brand-600)',
                                color: 'white',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                border: 'none',
                                fontWeight: 500,
                                cursor: 'pointer',
                                opacity: assigningClass || !selectedClassId || selectedClassId === student.class_id ? 0.7 : 1
                            }}
                        >
                            {assigningClass ? 'Saving...' : 'Update Assignment'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
