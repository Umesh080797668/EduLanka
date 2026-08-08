'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClass, RequestOpts } from '@/lib/api/school';

export default function NewClassPage() {
    const router = useRouter();
    const [grade, setGrade] = useState('1');
    const [section, setSection] = useState('');
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [medium, setMedium] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const opts: RequestOpts = { token: 'DEMO', tenantId: 'DEMO' };
        try {
            await createClass({
                grade: parseInt(grade, 10),
                section,
                year: parseInt(year, 10),
                medium: medium === '' ? undefined : (medium as any)
            }, opts);
            router.push('/admin/classes');
        } catch (err: any) {
            setError(err.message);
            setSaving(false);
        }
    };

    return (
        <div style={{ maxWidth: '600px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href="/admin/classes" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
                    &larr; Back to Classes
                </Link>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '0.5rem' }}>Create New Class</h1>
            </div>

            {error && (
                <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '1.5rem' }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ background: 'white', padding: '2rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Grade (1-13) *</label>
                    <input
                        type="number"
                        min="1" max="13"
                        required
                        value={grade}
                        onChange={e => setGrade(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Section *</label>
                    <input
                        type="text"
                        required
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        placeholder="e.g. A, B, Science 1"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Instruction Medium</label>
                    <select
                        value={medium}
                        onChange={(e) => setMedium(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    >
                        <option value="">Not Applicable / Combined</option>
                        <option value="ENGLISH">English Medium</option>
                        <option value="SINHALA">Sinhala Medium</option>
                        <option value="TAMIL">Tamil Medium</option>
                    </select>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Academic Year</label>
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
                        href="/admin/classes"
                        style={{ padding: '0.75rem 1.5rem', borderRadius: '6px', color: '#374151', textDecoration: 'none', background: '#f3f4f6', fontWeight: 500 }}
                    >
                        Cancel
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
                        {saving ? 'Creating...' : 'Create Class'}
                    </button>
                </div>
            </form>
        </div>
    );
}
