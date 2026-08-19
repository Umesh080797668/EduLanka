'use client';
import { authManager } from '@/lib/auth-store';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { fetchStudents, RequestOpts } from '@/lib/api/school';
import type { StudentProfile } from '@edu-lanka/shared-types';
import { useTranslations } from 'next-intl';
import { PageSkeleton } from '@/components/ui/Skeleton';

export default function StudentsPage() {
    const t = useTranslations('InstitutionAdminStudents');
    const [students, setStudents] = useState<StudentProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // TODO (Phase 1): Retrieve auth token & tenantId from context/session
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        fetchStudents(opts)
            .then(setStudents)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{t('title')}</h1>
                <Link
                    href="/institution-admin/students/new"
                    style={{
                        background: 'var(--color-brand-600)',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontWeight: 500,
                    }}
                >
                    {t('enrollStudent')}
                </Link>
            </div>

            {loading ? (
                <PageSkeleton />
            ) : error ? (
                <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px' }}>
                    {error}
                </div>
            ) : students.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#6b7280', marginBottom: '1rem' }}>{t('noStudents')}</p>
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>{t('admissionNo')}</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>{t('name')}</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>{t('class')}</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>{t('status')}</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151', textAlign: 'right' }}>{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((student) => (
                                <tr key={student.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.75rem 1rem' }}>{student.admission_no}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div style={{ fontWeight: 500 }}>{student.users?.full_name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{student.users?.email}</div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        {student.classes ? `Grade ${student.classes.grade}-${student.classes.section}` : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>{t('unassigned')}</span>}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                            background: student.users?.is_active ? '#dcfce7' : '#fee2e2',
                                            color: student.users?.is_active ? '#166534' : '#991b1b'
                                        }}>
                                            {student.users?.is_active ? t('active') : t('inactive')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                        <Link
                                            href={`/institution-admin/students/${student.id}`}
                                            style={{ color: 'var(--color-brand-600)', textDecoration: 'none', fontWeight: 500 }}
                                        >
                                            {t('view')} &rarr;
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
