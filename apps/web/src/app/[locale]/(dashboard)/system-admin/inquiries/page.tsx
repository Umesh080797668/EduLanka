'use client';
import { authManager } from '@/lib/auth-store';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { fetchInquiries, updateInquiryStatus, RequestOpts } from '@/lib/api/school';
import { Loader2, Check, X } from 'lucide-react';

export default function InquiriesPage() {
    const t = useTranslations('Inquiries');
    const te = useTranslations('InquiriesExtras');
    const [inquiries, setInquiries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const safeFetch = () => {
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || ''
        };
        return fetchInquiries(opts)
            .then(data => setInquiries(data))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        safeFetch();
    }, []);

    const handleUpdateStatus = async (id: string, newStatus: 'RESOLVED' | 'REJECTED') => {
        setActionLoading(id);
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || ''
        };
        try {
            await updateInquiryStatus(id, newStatus, opts);
            await safeFetch();
        } catch (err: any) {
            setError(err.message || 'Failed to update status');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{te('loading')}</div>;
    if (error) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{te('loadingError')}{error}</div>;

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
                            <th style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151', textAlign: 'right' }}>{te('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inquiries.length > 0 ? inquiries.map((inq) => (
                            <tr key={inq.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                    {inq.users?.full_name || 'N/A'}
                                    {inq.tenants?.name && (
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>
                                            {te('school')}{inq.tenants.name}
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
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    {inq.status === 'PENDING' && (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button
                                                disabled={actionLoading === inq.id}
                                                onClick={() => handleUpdateStatus(inq.id, 'RESOLVED')}
                                                style={{
                                                    padding: '0.4rem', background: '#dcfce7', color: '#166534',
                                                    borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: actionLoading === inq.id ? 0.5 : 1
                                                }}
                                                title={te('resolve')}
                                            >
                                                {actionLoading === inq.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            </button>
                                            <button
                                                disabled={actionLoading === inq.id}
                                                onClick={() => handleUpdateStatus(inq.id, 'REJECTED')}
                                                style={{
                                                    padding: '0.4rem', background: '#fee2e2', color: '#991b1b',
                                                    borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: actionLoading === inq.id ? 0.5 : 1
                                                }}
                                                title={te('reject')}
                                            >
                                                {actionLoading === inq.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    )}
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
