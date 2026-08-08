'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchParent, fetchStudents, linkStudentToParent, unlinkStudentFromParent, RequestOpts } from '@/lib/api/school';
import type { ParentProfile, StudentProfile } from '@edu-lanka/shared-types';
import { ParentRelationship } from '@edu-lanka/shared-types';

export default function ParentDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [parent, setParent] = useState<ParentProfile | null>(null);
    const [allStudents, setAllStudents] = useState<StudentProfile[]>([]);

    // Mapping state
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [relationship, setRelationship] = useState<ParentRelationship>(ParentRelationship.FATHER);

    const [loading, setLoading] = useState(true);
    const [mapping, setMapping] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
            const [parentData, studentsData] = await Promise.all([
                fetchParent(params.id, opts),
                fetchStudents(opts)
            ]);
            setParent(parentData);
            setAllStudents(studentsData);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [params.id]);

    const handleLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setMapping(true);
        try {
            const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
            await linkStudentToParent(params.id, { studentId: selectedStudentId, relationship }, opts);
            setSelectedStudentId('');
            await loadData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setMapping(false);
        }
    };

    const handleUnlink = async (studentId: string) => {
        if (!confirm('Are you sure you want to decouple this student from this parent?')) return;
        try {
            const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
            await unlinkStudentFromParent(params.id, studentId, opts);
            await loadData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Parent Profile...</div>;
    if (error && !parent) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>;
    if (!parent) return <div style={{ padding: '2rem' }}>Parent not found.</div>;

    const linkedStudentIds = parent.parent_children?.map(pc => pc.student_id) || [];
    const availableStudents = allStudents.filter(s => !linkedStudentIds.includes(s.id));

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <button
                    onClick={() => router.back()}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginBottom: '1rem', font: 'inherit' }}
                >
                    &larr; Back to Parents
                </button>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 600, color: '#111827' }}>
                    {parent.full_name}
                </h1>
                <p style={{ color: '#4b5563', marginTop: '0.25rem' }}>
                    Contact: {parent.phone_number || parent.email || 'Unregistered'}
                </p>
                {error && <div style={{ marginTop: '1rem', padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px' }}>{error}</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                {/* Linked Children List */}
                <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.5rem' }}>Mapped Children</h2>

                    {!parent.parent_children || parent.parent_children.length === 0 ? (
                        <p style={{ color: '#6b7280', padding: '2rem 0', textAlign: 'center' }}>No students mapped to this parent yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {parent.parent_children.map((pc: any) => (
                                <div key={pc.student_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #f3f4f6', borderRadius: '6px' }}>
                                    <div>
                                        <div style={{ fontWeight: 500, color: '#111827' }}>{pc.students?.users?.full_name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                            Admission No: {pc.students?.admission_no} &bull; Relationship: {pc.relationship}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleUnlink(pc.student_id)}
                                        style={{ background: 'white', color: '#ef4444', border: '1px solid #fee2e2', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                        Unlink
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Link child form */}
                <div style={{ background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.5rem', height: 'fit-content' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Link a Student</h3>
                    <form onSubmit={handleLink} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Select Student</label>
                            <select
                                required
                                value={selectedStudentId}
                                onChange={(e) => setSelectedStudentId(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                            >
                                <option value="" disabled>-- Choose Student --</option>
                                {availableStudents.map(s => (
                                    <option key={s.id} value={s.id}>{s.users?.full_name} ({s.admission_no})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Relationship Context</label>
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
                            {mapping ? 'Linking...' : '+ Map Student Record'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
