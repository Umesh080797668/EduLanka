'use client';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import { fetchTeacher, RequestOpts } from '@/lib/api/school';
import type { TeacherProfile } from '@edu-lanka/shared-types';
import { useTranslations } from 'next-intl';

export default function TeacherDetailPage() {
    const t = useTranslations('InstitutionAdminTeachers');
    const params = useParams();
    const id = params?.id as string;

    const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };

        fetchTeacher(id, opts)
            .then(setTeacher)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('loadingTeacher')}</div>;
    if (error) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{error}</div>;
    if (!teacher) return <div style={{ padding: '2rem' }}>{t('teacherNotFound')}</div>;

    return (
        <div style={{ maxWidth: '800px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href="/institution-admin/teachers" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
                    &larr; {t('backTeachers')}
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{teacher.users?.full_name}</h1>
                    <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: teacher.users?.is_active ? '#dcfce7' : '#fee2e2',
                        color: teacher.users?.is_active ? '#166534' : '#991b1b'
                    }}>
                        {teacher.users?.is_active ? t('active') : t('inactive')}
                    </span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Profile Card */}
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                        {t('profileInfo')}
                    </h2>
                    <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem' }}>
                        <div>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>{t('employeeNumber')}</span>
                            <span style={{ fontWeight: 500 }}>{teacher.employee_no}</span>
                        </div>
                        <div>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>{t('email')}</span>
                            <span style={{ fontWeight: 500 }}>{teacher.users?.email}</span>
                        </div>
                        <div>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>{t('phone')}</span>
                            <span style={{ fontWeight: 500 }}>{teacher.users?.phone_number || t('none')}</span>
                        </div>
                        <div>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>{t('hireDate')}</span>
                            <span style={{ fontWeight: 500 }}>{teacher.hire_date || t('notSpecified')}</span>
                        </div>
                    </div>
                </div>

                {/* Subjects & Status */}
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                        {t('subjectAreas')}
                    </h2>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {teacher.subject_areas && teacher.subject_areas.length > 0 ? (
                            teacher.subject_areas.map(sub => (
                                <span key={sub} style={{ background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                                    {sub.replace('_', ' ')}
                                </span>
                            ))
                        ) : (
                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{t('noSubjects')}</span>
                        )}
                    </div>

                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginTop: '2rem', marginBottom: '1rem' }}>
                        {t('assignedClasses')}
                    </h2>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                        {t('phase2Manage')}
                    </p>
                </div>
            </div>
        </div>
    );
}
