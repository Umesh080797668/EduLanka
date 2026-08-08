'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchClasses, RequestOpts } from '@/lib/api/school';
import type { ClassProfile } from '@edu-lanka/shared-types';
import { useTranslations } from 'next-intl';

export default function ClassesPage() {
    const t = useTranslations('InstitutionAdminClasses');
    const [classes, setClasses] = useState<ClassProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
        fetchClasses(opts)
            .then(setClasses)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{t('title')}</h1>
                <Link
                    href="/institution-admin/classes/new"
                    style={{
                        background: 'var(--color-brand-600)',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontWeight: 500,
                    }}
                >
                    {t('createClass')}
                </Link>
            </div>

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>{t('loading')}</div>
            ) : error ? (
                <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px' }}>
                    {error}
                </div>
            ) : classes.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#6b7280', marginBottom: '1rem' }}>{t('noClasses')}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {classes.map((cls) => (
                        <div key={cls.id} style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{(cls as any).grades?.name || cls.grade?.name || t('unknown')} - {cls.section}</h2>
                                    <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>{t('year')} {cls.year}</p>
                                </div>
                            </div>

                            <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '1rem' }}>
                                <div><strong>{t('students')}</strong> {cls.studentCount || 0}</div>
                                <div style={{ marginTop: '0.5rem' }}>
                                    <strong>{t('homeroom')}</strong>{' '}
                                    {cls.class_teachers?.find(t => t.is_homeroom)?.teachers?.users?.full_name || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>{t('unassigned')}</span>}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <Link
                                    href={`/institution-admin/classes/${cls.id}`} // We'll assume a class detail page if needed later
                                    style={{
                                        padding: '0.5rem',
                                        background: '#f3f4f6',
                                        color: '#374151',
                                        borderRadius: '6px',
                                        textAlign: 'center',
                                        textDecoration: 'none',
                                        flex: 1,
                                        fontWeight: 500,
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    {t('manage')}
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
