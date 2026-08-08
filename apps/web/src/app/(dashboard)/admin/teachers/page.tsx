'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchTeachers, RequestOpts } from '@/lib/api/school';
import type { TeacherProfile } from '@edu-lanka/shared-types';

export default function TeachersPage() {
    const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const opts: RequestOpts = { token: 'DEMO', tenantId: 'DEMO' };
        fetchTeachers(opts)
            .then(setTeachers)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Teachers</h1>
                <Link
                    href="/admin/teachers/new" // NOTE: Form page placeholder
                    style={{
                        background: 'var(--color-brand-600)',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontWeight: 500,
                    }}
                >
                    + Add Teacher
                </Link>
            </div>

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading teachers...</div>
            ) : error ? (
                <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px' }}>
                    {error}
                </div>
            ) : teachers.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No teachers found.</p>
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>EMP No</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>Name</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>Subjects</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teachers.map((teacher) => (
                                <tr key={teacher.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.75rem 1rem' }}>{teacher.employee_no}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div style={{ fontWeight: 500 }}>{teacher.users?.full_name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{teacher.users?.email}</div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                            {teacher.subject_areas.slice(0, 3).map((sub, i) => (
                                                <span key={i} style={{ background: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                                                    {sub.replace('_', ' ')}
                                                </span>
                                            ))}
                                            {teacher.subject_areas.length > 3 && (
                                                <span style={{ fontSize: '0.75rem', color: '#6b7280', alignSelf: 'center' }}>
                                                    +{teacher.subject_areas.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                        <Link
                                            href={`/admin/teachers/${teacher.id}`}
                                            style={{ color: 'var(--color-brand-600)', textDecoration: 'none', fontWeight: 500 }}
                                        >
                                            View &rarr;
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
