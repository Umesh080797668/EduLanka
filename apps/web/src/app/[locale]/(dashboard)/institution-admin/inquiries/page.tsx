'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { fetchInquiries, RequestOpts } from '@/lib/api/school';

export default function InquiriesPage() {
    const t = useTranslations('Inquiries');
    const [inquiries, setInquiries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const opts: RequestOpts = {
            token: localStorage.getItem('token') || '',
            tenantId: localStorage.getItem('tenantId') || ''
        };
        fetchInquiries(opts)
            .then(data => setInquiries(data))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
    if (error) return <div style={{ padding: '2rem', color: '#b91c1c' }}>Error: {error}</div>;

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 600, color: '#111827' }}>
                    {t('title')}
                </h1>
                <p style={{ color: '#4b5563', marginTop: '0.25rem' }}>
                    {t('description')}
                </p>
            </div>

            <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{t('user')}</th>
                            <th style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{t('email')}</th>
                            <th style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{t('role')}</th>
                            <th style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151', width: '30%' }}>{t('message')}</th>
                            <th style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{t('status')}</th>
                            <th style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{t('date')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inquiries.length > 0 ? inquiries.map((inq) => (
                            <tr key={inq.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                    {inq.users?.full_name || 'N/A'}
                                    {inq.tenants?.name && (
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>
                                            School: {inq.tenants.name}
                                        </div>
                                    )}
                                </td>
                                <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#4b5563' }}>{inq.users?.email || 'N/A'}</td>
                                <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#4b5563' }}>
                                    <span style={{ padding: '0.2rem 0.5rem', background: '#f3f4f6', borderRadius: '4px', fontSize: '0.75rem' }}>
                                        {inq.role}
                                    </span>
                                </td>
                                <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '300px' }}>
                                    {inq.message}
                                </td>
                                <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                                    <span style={{
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '9999px',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        background: inq.status === 'PENDING' ? '#fef3c7' : '#dcfce7',
                                        color: inq.status === 'PENDING' ? '#b45309' : '#166534'
                                    }}>
                                        {inq.status}
                                    </span>
                                </td>
                                <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                                    {new Date(inq.created_at).toLocaleDateString()}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#6b7280' }}>
                                    {t('empty')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
