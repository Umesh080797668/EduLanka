'use client';
import { authManager } from '@/lib/auth-store';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import { fetchTeacher, updateTeacher, RequestOpts } from '@/lib/api/school';
import type { TeacherProfile } from '@edu-lanka/shared-types';
import { useTranslations } from 'next-intl';
import ImageUpload from '@/components/ui/ImageUpload';
import { Edit2, Save, Loader2 } from 'lucide-react';

export default function TeacherDetailPage() {
    const t = useTranslations('InstitutionAdminTeachers');
    const params = useParams();
    const id = params?.id as string;

    const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit Profile State
    const [isEditing, setIsEditing] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [editForm, setEditForm] = useState({ fullName: '', phoneNumber: '' });

    // Status Modal State
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [activeStep, setActiveStep] = useState<1 | 2>(1);
    const [deactivationReason, setDeactivationReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (!id) return;
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };

        fetchTeacher(id, opts)
            .then(setTeacher)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    const handleAvatarUpload = async (url: string) => {
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        try {
            const updated = await updateTeacher(id, { avatarUrl: url }, opts);
            setTeacher(updated);
        } catch (err: any) {
            alert(err.message || 'Error updating avatar');
        }
    };

    const toggleEdit = () => {
        if (!isEditing && teacher) {
            setEditForm({
                fullName: teacher.users?.full_name || '',
                phoneNumber: teacher.users?.phone_number || ''
            });
        }
        setIsEditing(!isEditing);
    };

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        try {
            const updated = await updateTeacher(id, {
                fullName: editForm.fullName,
                phoneNumber: editForm.phoneNumber
            }, opts);
            setTeacher(updated);
            setIsEditing(false);
        } catch (err: any) {
            alert(err.message || 'Error saving profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const confirmToggleStatus = async () => {
        if (!teacher || !teacher.users) return;

        setActionLoading(true);
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        try {
            const { setUserActive } = await import('@/lib/api/school');
            await setUserActive(teacher.user_id, !teacher.users.is_active, opts, deactivationReason);

            // Re-fetch to reflect
            const updated = await fetchTeacher(id, opts);
            setTeacher(updated);
        } catch (e: any) {
            setError(e.message || 'Failed to update user status');
        } finally {
            setActionLoading(false);
            setShowStatusModal(false);
            setDeactivationReason('');
            setActiveStep(1);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('loadingTeacher')}</div>;
    if (error) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{error}</div>;
    if (!teacher) return <div style={{ padding: '2rem' }}>{t('teacherNotFound')}</div>;

    const isActive = teacher.users?.is_active;

    return (
        <div style={{ maxWidth: '800px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href="/institution-admin/teachers" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
                    &larr; {t('backTeachers')}
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <ImageUpload
                            currentImageUrl={teacher.users?.avatar_url}
                            onUploadSuccess={handleAvatarUpload}
                            onError={(err) => alert(err)}
                            size={70}
                            className="shrink-0"
                        />
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {teacher.users?.full_name}
                                <span style={{
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    background: isActive ? '#dcfce7' : '#fee2e2',
                                    color: isActive ? '#166534' : '#991b1b',
                                    verticalAlign: 'middle'
                                }}>
                                    {isActive ? t('active') : t('inactive')}
                                </span>
                            </h1>
                            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{teacher.users?.email}</p>
                        </div>
                    </div>

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

            {showStatusModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.5)' }}>
                    <div style={{ background: 'white', borderRadius: '1rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', maxWidth: '28rem', width: '100%', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                            {isActive ? 'Suspend Teacher?' : 'Reactivate Teacher?'}
                        </h3>

                        {activeStep === 1 && (
                            <>
                                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                    Are you sure you want to {isActive ? 'suspend' : 'reactivate'} the account for <strong>{teacher.users?.full_name}</strong>?
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
                                    Please provide a reason for suspension (optional). This will be shown to the teacher when they try to log in.
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Profile Card */}
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                            {t('profileInfo')}
                        </h2>
                        {!isEditing ? (
                            <button onClick={toggleEdit} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                <Edit2 className="w-4 h-4" /> Edit
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={toggleEdit} disabled={savingProfile} style={{ border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}>
                                    Cancel
                                </button>
                                <button onClick={handleSaveProfile} disabled={savingProfile} style={{ border: 'none', background: '#6366f1', cursor: 'pointer', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    {savingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                                </button>
                            </div>
                        )}
                    </div>

                    {!isEditing ? (
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
                    ) : (
                        <div style={{ display: 'grid', gap: '1rem', fontSize: '0.875rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#374151', fontWeight: 500, marginBottom: '0.25rem' }}>Full Name</label>
                                <input
                                    type="text"
                                    value={editForm.fullName}
                                    onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                                    style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#374151', fontWeight: 500, marginBottom: '0.25rem' }}>Phone Number</label>
                                <input
                                    type="text"
                                    value={editForm.phoneNumber}
                                    onChange={e => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                                    style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                        </div>
                    )}
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
