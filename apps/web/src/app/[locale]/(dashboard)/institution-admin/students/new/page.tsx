'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Link } from '@/i18n/routing';
import { enrollStudent, RequestOpts } from '@/lib/api/school';
import { Gender, ALStream } from '@edu-lanka/shared-types';
import { useTranslations } from 'next-intl';

export default function NewStudentPage() {
    const t = useTranslations('InstitutionAdminStudents');
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        admissionNo: '',
        phoneNumber: '',
        dateOfBirth: '',
        gender: Gender.MALE,
        alStream: '' as ALStream | '',
        medium: '',
        temporaryPassword: 'TempPassword123!',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
        try {
            await enrollStudent({
                ...formData,
                alStream: formData.alStream === '' ? undefined : formData.alStream,
                medium: formData.medium === '' ? undefined : (formData.medium as any)
            }, opts);
            router.push('/institution-admin/students');
        } catch (err: any) {
            setError(err.message);
            setSaving(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href="/institution-admin/students" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
                    &larr; {t('backStudents')}
                </Link>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '0.5rem' }}>{t('enrollNewStudent')}</h1>
            </div>

            {error && (
                <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '1.5rem' }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ background: 'white', padding: '2rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>{t('accountDetails')}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('fullName')}</label>
                        <input
                            type="text" required
                            value={formData.fullName}
                            onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('emailAddress')}</label>
                        <input
                            type="email" required
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('tempPassword')}</label>
                        <input
                            type="text" required
                            value={formData.temporaryPassword}
                            onChange={e => setFormData({ ...formData, temporaryPassword: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('phoneNumber')}</label>
                        <input
                            type="text"
                            value={formData.phoneNumber}
                            onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                    </div>
                </div>

                <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>{t('schoolProfile')}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('instructionMedium')}</label>
                        <select
                            value={formData.medium || ''}
                            onChange={e => setFormData({ ...formData, medium: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        >
                            <option value="">{t('noneNotSpecified')}</option>
                            <option value="ENGLISH">{t('english')}</option>
                            <option value="SINHALA">{t('sinhala')}</option>
                            <option value="TAMIL">{t('tamil')}</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('classAssignmentOpt')}</label>
                        <input
                            type="text" placeholder={t('autoGeneratedIfBlank')}
                            value={formData.admissionNo}
                            onChange={e => setFormData({ ...formData, admissionNo: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('dob')}</label>
                        <input
                            type="date"
                            value={formData.dateOfBirth}
                            onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('gender')}</label>
                        <select
                            value={formData.gender}
                            onChange={e => setFormData({ ...formData, gender: e.target.value as Gender })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        >
                            <option value={Gender.MALE}>{t('male')}</option>
                            <option value={Gender.FEMALE}>{t('female')}</option>
                            <option value={Gender.OTHER}>{t('other')}</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>{t('alStream')}</label>
                        <select
                            value={formData.alStream}
                            onChange={e => setFormData({ ...formData, alStream: e.target.value as ALStream | '' })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        >
                            <option value="">{t('noneDash')}</option>
                            <option value={ALStream.MATHS}>{t('maths')}</option>
                            <option value={ALStream.SCIENCE}>{t('science')}</option>
                            <option value={ALStream.COMMERCE}>{t('commerce')}</option>
                            <option value={ALStream.ARTS}>{t('arts')}</option>
                            <option value={ALStream.TECHNOLOGY}>{t('technology')}</option>
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '3rem' }}>
                    <Link
                        href="/institution-admin/students"
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
                        {saving ? t('enrolling') : t('enrollStudentBtn')}
                    </button>
                </div>
            </form>
        </div>
    );
}
