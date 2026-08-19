'use client';
import { authManager } from '@/lib/auth-store';

import { useState, useEffect, use } from 'react';
import { useRouter } from '@/i18n/routing';
import { fetchParent, fetchStudents, linkStudentToParent, unlinkStudentFromParent, updateParent, RequestOpts } from '@/lib/api/school';
import type { ParentProfile, StudentProfile } from '@edu-lanka/shared-types';
import { ParentRelationship } from '@edu-lanka/shared-types';
import { useTranslations } from 'next-intl';
import ImageUpload from '@/components/ui/ImageUpload';

export default function ParentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const t = useTranslations('InstitutionAdminParents');
    const router = useRouter();
    const [parent, setParent] = useState<ParentProfile | null>(null);
    const [allStudents, setAllStudents] = useState<StudentProfile[]>([]);

    // Mapping state
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [relationship, setRelationship] = useState<ParentRelationship>(ParentRelationship.FATHER);

    const [loading, setLoading] = useState(true);
    const [mapping, setMapping] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editForm, setEditForm] = useState({
        fullName: '',
        email: '',
        phoneNumber: '',
        avatarUrl: ''
    });

    // Status Modal State
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [activeStep, setActiveStep] = useState<1 | 2>(1);
    const [deactivationReason, setDeactivationReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
            const [parentData, studentsData] = await Promise.all([
                fetchParent(id, opts),
                fetchStudents(opts)
            ]);
            setParent(parentData);
            setEditForm({
                fullName: parentData.full_name,
                email: parentData.email || '',
                phoneNumber: parentData.phone_number || '',
                avatarUrl: parentData.avatar_url || ''
            });
            setAllStudents(studentsData);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        Promise.resolve().then(() => loadData());
    }, [id]);

    const handleLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setMapping(true);
        try {
            const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
            await linkStudentToParent(id, { studentId: selectedStudentId, relationship }, opts);
            setSelectedStudentId('');
            await loadData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setMapping(false);
        }
    };

    const handleUnlink = async (studentId: string) => {
        if (!confirm(t('unlinkConfirm'))) return;
        try {
            const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
            await unlinkStudentFromParent(id, studentId, opts);
            await loadData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const confirmToggleStatus = async () => {
        if (!parent) return;

        setActionLoading(true);
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        try {
            const { setUserActive } = await import('@/lib/api/school');
            await setUserActive(parent.id, !parent.is_active, opts, deactivationReason);

            await loadData();
        } catch (e: any) {
            setError(e.message || 'Failed to update user status');
        } finally {
            setActionLoading(false);
            setShowStatusModal(false);
            setDeactivationReason('');
            setActiveStep(1);
        }
    };

    const handleSaveEdit = async () => {
        if (!parent) return;
        setSavingEdit(true);
        try {
            const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
            await updateParent(parent.id, editForm, opts);
            setIsEditing(false);
            await loadData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSavingEdit(false);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('loadingParent')}</div>;
    if (error && !parent) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>;
    if (!parent) return <div style={{ padding: '2rem' }}>{t('parentNotFound')}</div>;

    const linkedStudentIds = parent.parents?.map(pc => pc.student_id) || [];
    const availableStudents = allStudents.filter(s => !linkedStudentIds.includes(s.id));

    const isActive = parent.is_active;

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <button
                    onClick={() => router.back()}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginBottom: '1rem', font: 'inherit' }}
                >
                    &larr; {t('backParents')}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        {isEditing ? (
                            <ImageUpload
                                currentImageUrl={editForm.avatarUrl}
                                onUploadSuccess={(url) => setEditForm({ ...editForm, avatarUrl: url })}
                                onError={(err) => alert(err)}
                                size={64}
                            />
                        ) : (
                            <div
                                style={{ width: 64, height: 64, borderRadius: '50%', background: parent.avatar_url ? `url(${parent.avatar_url}) center/cover` : '#e5e7eb', flexShrink: 0 }}
                            />
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {isEditing ? (
                                <input
                                    type="text" required
                                    value={editForm.fullName}
                                    onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                                    style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '1.3rem', fontWeight: 600 }}
                                />
                            ) : (
                                <h1 style={{ fontSize: '1.8rem', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '1rem', margin: 0 }}>
                                    {parent.full_name}
                                    <span style={{
                                        padding: '0.25rem 0.6rem',
                                        borderRadius: '9999px',
                                        fontSize: '0.8rem',
                                        fontWeight: 500,
                                        background: isActive ? '#dcfce7' : '#fee2e2',
                                        color: isActive ? '#166534' : '#991b1b',
                                        border: `1px solid ${isActive ? '#bbf7d0' : '#fecaca'}`
                                    }}>
                                        {isActive ? t('active') : t('inactive')}
                                    </span>
                                </h1>
                            )}

                            {isEditing ? (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="tel"
                                        placeholder="Phone"
                                        value={editForm.phoneNumber}
                                        onChange={e => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                                        style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                                    />
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        value={editForm.email}
                                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                        style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                                    />
                                </div>
                            ) : (
                                <p style={{ color: '#4b5563', margin: 0 }}>
                                    {t('contact')}: {parent.phone_number || parent.email || t('unregistered')}
                                </p>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {isEditing ? (
                            <>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    style={{ padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', background: 'white', border: '1px solid #d1d5db', color: '#374151' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={savingEdit}
                                    style={{ padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', background: 'var(--color-brand-600)', border: 'none', color: 'white', opacity: savingEdit ? 0.7 : 1 }}
                                >
                                    {savingEdit ? 'Saving...' : 'Save'}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    background: 'white',
                                    border: '1px solid #d1d5db',
                                    color: '#374151'
                                }}
                            >
                                Edit Profile
                            </button>
                        )}

                        <button
                            onClick={() => {
                                setDeactivationReason('');
                                setActiveStep(1);
                                setShowStatusModal(true);
                            }}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                background: 'white',
                                border: `1px solid ${isActive ? '#fca5a5' : '#86efac'}`,
                                color: isActive ? '#dc2626' : '#16a34a'
                            }}
                        >
                            {isActive ? 'Suspend Account' : 'Reactivate Account'}
                        </button>
                    </div>
                </div>
                {error && <div style={{ marginTop: '1rem', padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px' }}>{error}</div>}
            </div>

            {showStatusModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.5)' }}>
                    <div style={{ background: 'white', borderRadius: '1rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', maxWidth: '28rem', width: '100%', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                            {isActive ? 'Suspend Parent?' : 'Reactivate Parent?'}
                        </h3>

                        {activeStep === 1 && (
                            <>
                                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                    Are you sure you want to {isActive ? 'suspend' : 'reactivate'} the account for <strong>{parent.full_name}</strong>?
                                    {isActive ? ' They will lose access to the portal immediately.' : ' They will regain portal access.'}
                                </p>
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setShowStatusModal(false)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', background: '#f1f5f9', color: '#475569', fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => isActive ? setActiveStep(2) : confirmToggleStatus()}
                                        style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', background: isActive ? '#e11d48' : '#059669', color: 'white', fontWeight: 500, border: 'none', cursor: 'pointer' }}
                                    >
                                        {isActive ? 'Proceed to Suspend' : 'Yes, Reactivate'}
                                    </button>
                                </div>
                            </>
                        )}

                        {activeStep === 2 && (
                            <>
                                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                                    Please provide a reason for suspension (optional). This will be shown to the parent when they try to log in.
                                </p>
                                <textarea
                                    rows={3}
                                    placeholder="Enter reason..."
                                    value={deactivationReason}
                                    onChange={(e) => setDeactivationReason(e.target.value)}
                                    style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.875rem', marginBottom: '1.5rem', resize: 'none' }}
                                />
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setActiveStep(1)} disabled={actionLoading} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', background: '#f1f5f9', color: '#475569', fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                                        Back
                                    </button>
                                    <button
                                        onClick={confirmToggleStatus}
                                        disabled={actionLoading}
                                        style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', background: '#e11d48', color: 'white', fontWeight: 500, border: 'none', cursor: 'pointer', opacity: actionLoading ? 0.7 : 1 }}
                                    >
                                        {actionLoading ? 'Saving...' : 'Confirm Suspension'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                {/* Linked Children List */}
                <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.5rem' }}>{t('mappedChildren')}</h2>

                    {!parent.parents || parent.parents.length === 0 ? (
                        <p style={{ color: '#6b7280', padding: '2rem 0', textAlign: 'center' }}>{t('noStudentsMapped')}</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {parent.parents.map((pc: any) => (
                                <div key={pc.student_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #f3f4f6', borderRadius: '6px' }}>
                                    <div>
                                        <div style={{ fontWeight: 500, color: '#111827' }}>{pc.students?.users?.full_name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                            {t('admissionNo')}: {pc.students?.admission_no} &bull; {t('relationship')}: {pc.relationship}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleUnlink(pc.student_id)}
                                        style={{ background: 'white', color: '#ef4444', border: '1px solid #fee2e2', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                        {t('unlink')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Link child form */}
                <div style={{ background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.5rem', height: 'fit-content' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>{t('linkStudent')}</h3>
                    <form onSubmit={handleLink} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>{t('selectStudent')}</label>
                            <select
                                required
                                value={selectedStudentId}
                                onChange={(e) => setSelectedStudentId(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                            >
                                <option value="" disabled>{t('chooseStudent')}</option>
                                {availableStudents.map(s => (
                                    <option key={s.id} value={s.id}>{s.users?.full_name} ({s.admission_no})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>{t('relationshipContext')}</label>
                            <select
                                value={relationship}
                                onChange={(e) => setRelationship(e.target.value as ParentRelationship)}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                            >
                                {Object.values(ParentRelationship).map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={!selectedStudentId || mapping}
                            style={{
                                marginTop: '0.5rem',
                                background: !selectedStudentId || mapping ? '#9ca3af' : 'var(--color-brand-600)',
                                color: 'white',
                                padding: '0.75rem',
                                borderRadius: '4px',
                                border: 'none',
                                fontWeight: 500,
                                cursor: !selectedStudentId || mapping ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {mapping ? t('linking') : t('mapStudent')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
