'use client';
import { authManager } from '@/lib/auth-store';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import { fetchStudent, fetchClasses, assignClassToStudent, updateStudent, RequestOpts } from '@/lib/api/school';
import type { StudentProfile, ClassProfile } from '@edu-lanka/shared-types';
import { useTranslations } from 'next-intl';
import ImageUpload from '@/components/ui/ImageUpload';
import { Edit2, Save, Loader2 } from 'lucide-react';

export default function StudentDetailPage() {
    const t = useTranslations('InstitutionAdminStudents');
    const params = useParams();
    const id = params?.id as string;

    const [student, setStudent] = useState<StudentProfile | null>(null);
    const [classes, setClasses] = useState<ClassProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit Profile State
    const [isEditing, setIsEditing] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [editForm, setEditForm] = useState({ fullName: '', phoneNumber: '', gender: '', dateOfBirth: '' });

    // Class assignment state
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [assigningClass, setAssigningClass] = useState(false);

    // Status Modal State
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [activeStep, setActiveStep] = useState<1 | 2>(1);
    const [deactivationReason, setDeactivationReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (!id) return;
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };

        Promise.all([
            fetchStudent(id, opts),
            fetchClasses(opts)
        ])
            .then(([studentData, classesData]) => {
                setStudent(studentData);
                setClasses(classesData);
                if (studentData.class_id) {
                    setSelectedClassId(studentData.class_id);
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    const handleAssignClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClassId) return;

        setAssigningClass(true);
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        try {
            const updated = await assignClassToStudent(id, selectedClassId, opts);
            setStudent(updated);
            alert(t('classAssignedSuccess'));
        } catch (err: any) {
            alert(err.message);
        } finally {
            setAssigningClass(false);
        }
    };

    const handleAvatarUpload = async (url: string) => {
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        try {
            const updated = await updateStudent(id, { avatarUrl: url }, opts);
            setStudent(updated);
        } catch (err: any) {
            alert(err.message || 'Error updating avatar');
        }
    };

    const toggleEdit = () => {
        if (!isEditing && student) {
            setEditForm({
                fullName: student.users?.full_name || '',
                phoneNumber: student.users?.phone_number || '',
                gender: student.gender || '',
                dateOfBirth: student.date_of_birth || ''
            });
        }
        setIsEditing(!isEditing);
    };

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        try {
            const updated = await updateStudent(id, {
                fullName: editForm.fullName,
                phoneNumber: editForm.phoneNumber,
                gender: editForm.gender,
                dateOfBirth: editForm.dateOfBirth
            }, opts);
            setStudent(updated);
            setIsEditing(false);
        } catch (err: any) {
            alert(err.message || 'Error saving profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const confirmToggleStatus = async () => {
        if (!student || !student.users) return;

        setActionLoading(true);
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        try {
            const { setUserActive } = await import('@/lib/api/school');
            await setUserActive(student.user_id, !student.users.is_active, opts, deactivationReason);

            // Re-fetch to reflect
            const updated = await fetchStudent(id, opts);
            setStudent(updated);
        } catch (e: any) {
            setError(e.message || 'Failed to update user status');
        } finally {
            setActionLoading(false);
            setShowStatusModal(false);
            setDeactivationReason('');
            setActiveStep(1);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('loadingStudent')}</div>;
    if (error) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{error}</div>;
    if (!student) return <div style={{ padding: '2rem' }}>{t('studentNotFound')}</div>;

    const isActive = student.users?.is_active;

    return (
        <div style={{ maxWidth: '800px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href="/institution-admin/students" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
                    &larr; {t('backStudents')}
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <ImageUpload
                            currentImageUrl={student.users?.avatar_url}
                            onUploadSuccess={handleAvatarUpload}
                            onError={(err) => alert(err)}
                            size={70}
                            className="shrink-0"
                        />
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {student.users?.full_name}
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
                            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{student.users?.email}</p>
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
                            {isActive ? 'Suspend Student?' : 'Reactivate Student?'}
                        </h3>

                        {activeStep === 1 && (
                            <>
                                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                    Are you sure you want to {isActive ? 'suspend' : 'reactivate'} the account for <strong>{student.users?.full_name}</strong>?
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
                                    Please provide a reason for suspension (optional). This will be shown to the student when they try to log in.
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
                                <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>{t('admissionNumber')}</span>
                                <span style={{ fontWeight: 500 }}>{student.admission_no}</span>
                            </div>
                            <div>
                                <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>{t('email')}</span>
                                <span style={{ fontWeight: 500 }}>{student.users?.email}</span>
                            </div>
                            <div>
                                <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>{t('phone')}</span>
                                <span style={{ fontWeight: 500 }}>{student.users?.phone_number || t('none')}</span>
                            </div>
                            <div>
                                <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>{t('dob')}</span>
                                <span style={{ fontWeight: 500 }}>{student.date_of_birth || t('notSpecified')}</span>
                            </div>
                            <div>
                                <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>{t('gender')}</span>
                                <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{student.gender || t('notSpecified')}</span>
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
                            <div>
                                <label style={{ display: 'block', color: '#374151', fontWeight: 500, marginBottom: '0.25rem' }}>Date of Birth</label>
                                <input
                                    type="date"
                                    value={editForm.dateOfBirth}
                                    onChange={e => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                                    style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#374151', fontWeight: 500, marginBottom: '0.25rem' }}>Gender</label>
                                <select
                                    value={editForm.gender}
                                    onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                                    style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                >
                                    <option value="">Not Specified</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Class Assignment Card */}
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                        {t('classAssignment')}
                    </h2>

                    {student.classes && (
                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t('currentlyAssignedTo')}</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{(student.classes.grade as any)?.name ?? `Grade ${student.classes.grade}`}-{student.classes.section}</div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t('year')} {student.classes.year}</div>
                        </div>
                    )}

                    <form onSubmit={handleAssignClass}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                            {t('changeClass')}
                        </label>
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', marginBottom: '1rem' }}
                        >
                            <option value="">{t('noClassSelected')}</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>
                                    {(cls.grade as any)?.name ?? `Grade ${cls.grade}`}-{cls.section} ({cls.year})
                                </option>
                            ))}
                        </select>
                        <button
                            type="submit"
                            disabled={assigningClass || !selectedClassId || selectedClassId === student.class_id}
                            style={{
                                width: '100%',
                                background: 'var(--color-brand-600)',
                                color: 'white',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                border: 'none',
                                fontWeight: 500,
                                cursor: 'pointer',
                                opacity: assigningClass || !selectedClassId || selectedClassId === student.class_id ? 0.7 : 1
                            }}
                        >
                            {assigningClass ? t('saving') : t('updateAssignment')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
