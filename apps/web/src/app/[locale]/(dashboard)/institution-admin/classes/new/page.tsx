'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Link } from '@/i18n/routing';
import { createClass, fetchGrades, RequestOpts } from '@/lib/api/school';
import type { GradeProfile } from '@edu-lanka/shared-types';
import { useTranslations } from 'next-intl';

export default function NewClassPage() {
    const t = useTranslations('InstitutionAdminClasses');
    const router = useRouter();
    const [grades, setGrades] = useState<GradeProfile[]>([]);
    const [gradeId, setGradeId] = useState('');
    const [section, setSection] = useState('');
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [medium, setMedium] = useState('');
    const [saving, setSaving] = useState(false);
    const [loadingGrades, setLoadingGrades] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
        fetchGrades(opts).then(res => {
            setGrades(res);
            if (res.length > 0) setGradeId(res[0].id);
        }).finally(() => setLoadingGrades(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
        try {
            await createClass({
                gradeId,
                section,
                year: parseInt(year, 10),
                medium: medium === '' ? undefined : (medium as any)
            }, opts);
            router.push('/institution-admin/classes');
        } catch (err: any) {
            setError(err.message);
            setSaving(false);
        }
    };

    return (
        <div style={{ maxWidth: '600px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href="/institution-admin/classes" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
                    &larr; {t('backClasses')}
                </Link>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '0.5rem' }}>{t('createNew')}</h1>
            </div>

            {error && (
                <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '1.5rem' }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ background: 'white', padding: '2rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('curriculumGrade')}</label>
                    <select
                        required
                        disabled={loadingGrades}
                        value={gradeId}
                        onChange={e => setGradeId(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    >
                        {loadingGrades ? <option>{t('loadingGrades')}</option> : null}
                        {grades.map(g => (
                            <option key={g.id} value={g.id}>{g.name} — {String(g.curriculum_type || '').replace('_', ' ')}</option>
                        ))}
                    </select>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('section')}</label>
                    <input
                        type="text"
                        required
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        placeholder={t('sectionHint')}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('instructionMedium')}</label>
                    <select
                        value={medium}
                        onChange={(e) => setMedium(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    >
                        <option value="">{t('notApplicable')}</option>
                        <option value="ENGLISH">{t('englishMed')}</option>
                        <option value="SINHALA">{t('sinhalaMed')}</option>
                        <option value="TAMIL">{t('tamilMed')}</option>
                    </select>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('academicYear')}</label>
                    <input
                        type="number"
                        required
                        value={year}
                        onChange={e => setYear(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <Link
                        href="/institution-admin/classes"
                        style={{ padding: '0.75rem 1.5rem', borderRadius: '6px', color: '#374151', textDecoration: 'none', background: '#f3f4f6', fontWeight: 500 }}
                    >
                        {t('cancel')}
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            background: 'var(--color-brand-600)',
                            color: 'white',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '6px',
                            border: 'none',
                            fontWeight: 500,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.7 : 1,
                        }}
                    >
                        {saving ? t('creating') : t('createForm')}
                    </button>
                </div>
            </form>
        </div>
    );
}
