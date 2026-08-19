'use client';
import { authManager } from '@/lib/auth-store';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { fetchParents, deactivateParent, RequestOpts } from '@/lib/api/school';
import type { ParentProfile } from '@edu-lanka/shared-types';
import { useTranslations } from 'next-intl';
import { PageSkeleton } from '@/components/ui/Skeleton';
import MultiStepModal from '@/components/ui/MultiStepModal';
import { Trash2 } from 'lucide-react';

export default function ParentsPage() {
    const t = useTranslations('InstitutionAdminParents');
    const [parents, setParents] = useState<ParentProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [parentToDelete, setParentToDelete] = useState<ParentProfile | null>(null);

    const handleDeleteConfirm = async () => {
        if (!parentToDelete) return;
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        await deactivateParent(parentToDelete.id, opts);
        setParents(prev => prev.map(p => p.id === parentToDelete.id ? { ...p, is_active: false } : p));
    };

    useEffect(() => {
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        fetchParents(opts)
            .then((data) => {
                setParents(data);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{t('title')}</h1>
                <Link
                    href="/institution-admin/parents/new"
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-sm text-sm"
                >
                    {t('addParent')}
                </Link>
            </div>

            {loading ? (
                <PageSkeleton />
            ) : error ? (
                <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px' }}>
                    {error}
                </div>
            ) : parents.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#6b7280', marginBottom: '1rem' }}>{t('noParents')}</p>
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>{t('parentName')}</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>{t('contact')}</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>{t('childrenLinked')}</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151', textAlign: 'right' }}>{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parents.map((parent) => (
                                <tr key={parent.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div style={{ fontWeight: 500 }}>{parent.full_name}</div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div style={{ color: '#4b5563' }}>{parent.phone_number || parent.email || t('na')}</div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <span style={{
                                            background: parent.parents && parent.parents.length > 0 ? '#d1fae5' : '#f3f4f6',
                                            color: parent.parents && parent.parents.length > 0 ? '#065f46' : '#6b7280',
                                            padding: '0.2rem 0.6rem',
                                            borderRadius: '999px',
                                            fontSize: '0.8rem',
                                            fontWeight: 500
                                        }}>
                                            {parent.parents?.length || 0} {t('children')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                            <Link
                                                href={`/institution-admin/parents/${parent.id}?edit=true`}
                                                style={{ color: 'var(--color-brand-600)', textDecoration: 'none', fontWeight: 500, marginRight: '0.5rem' }}
                                            >
                                                Edit
                                            </Link>
                                            <Link
                                                href={`/institution-admin/parents/${parent.id}`}
                                                style={{ color: 'var(--color-brand-600)', textDecoration: 'none', fontWeight: 500 }}
                                            >
                                                {t('viewMap')} &rarr;
                                            </Link>
                                            <button
                                                onClick={() => setParentToDelete(parent)}
                                                style={{ padding: '0.35rem', border: 'none', background: '#fee2e2', borderRadius: '4px', cursor: 'pointer', color: '#b91c1c' }}
                                                title="Deactivate Parent"
                                            >
                                                <Trash2 style={{ width: '1rem', height: '1rem' }} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <MultiStepModal
                isOpen={!!parentToDelete}
                onClose={() => setParentToDelete(null)}
                title="Deactivate Parent"
                steps={[
                    {
                        title: 'Are you absolutely sure?',
                        description: `This action will initiate the deactivation process for this parent. Their access will be revoked but historical data will be preserved.`,
                        confirmText: 'Yes, proceed',
                        isDestructive: true
                    },
                    {
                        title: 'Confirm Deactivation',
                        description: 'Please confirm once more. They will no longer be able to log in to the portal.',
                        confirmText: 'Deactivate Parent',
                        isDestructive: true
                    }
                ]}
                onComplete={handleDeleteConfirm}
            />
        </div>
    );
}
