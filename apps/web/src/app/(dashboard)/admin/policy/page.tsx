'use client';

import { useState, useEffect } from 'react';
import { fetchPolicy, updatePolicy, RequestOpts } from '@/lib/api/school';
import type { SchoolPolicy } from '@edu-lanka/shared-types';

export default function SchoolPolicyPage() {
    const [, setPolicy] = useState<SchoolPolicy | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState<Partial<SchoolPolicy>>({});

    useEffect(() => {
        const opts: RequestOpts = { token: 'DEMO', tenantId: 'DEMO' };
        fetchPolicy(opts)
            .then((data) => {
                setPolicy(data);
                setFormData(data);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(null);

        const opts: RequestOpts = { token: 'DEMO', tenantId: 'DEMO' };
        try {
            const updated = await updatePolicy(formData, opts);
            setPolicy(updated);
            setSuccess('School policy updated successfully');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading policy settings...</div>;

    return (
        <div style={{ maxWidth: '800px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>School Policy Settings</h1>

            {error && (
                <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '1.5rem' }}>
                    {error}
                </div>
            )}

            {success && (
                <div style={{ padding: '1rem', background: '#dcfce7', color: '#166534', borderRadius: '6px', marginBottom: '1.5rem' }}>
                    {success}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ background: 'white', padding: '2rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Academic Year</label>
                        <input
                            type="number"
                            value={formData.academic_year || ''}
                            onChange={e => setFormData({ ...formData, academic_year: parseInt(e.target.value, 10) })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Max Students per Class</label>
                        <input
                            type="number"
                            value={formData.max_students_per_class || ''}
                            onChange={e => setFormData({ ...formData, max_students_per_class: parseInt(e.target.value, 10) })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>School Hours Start</label>
                        <input
                            type="time" step="1"
                            value={formData.school_hours_start || ''}
                            onChange={e => setFormData({ ...formData, school_hours_start: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>School Hours End</label>
                        <input
                            type="time" step="1"
                            value={formData.school_hours_end || ''}
                            onChange={e => setFormData({ ...formData, school_hours_end: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Default Language</label>
                        <select
                            value={formData.default_language || 'en'}
                            onChange={e => setFormData({ ...formData, default_language: e.target.value as 'en' | 'si' | 'ta' })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        >
                            <option value="en">English (en)</option>
                            <option value="si">Sinhala (si)</option>
                            <option value="ta">Tamil (ta)</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Supported Mediums (hold Ctrl/Cmd to multi-select)</label>
                        <select
                            multiple
                            value={formData.supported_mediums || []}
                            onChange={e => {
                                const options = Array.from(e.target.selectedOptions);
                                setFormData({ ...formData, supported_mediums: options.map(o => o.value as any) });
                            }}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', minHeight: '80px' }}
                        >
                            <option value="ENGLISH">English</option>
                            <option value="SINHALA">Sinhala</option>
                            <option value="TAMIL">Tamil</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Timezone</label>
                        <input
                            type="text"
                            value={formData.timezone || ''}
                            onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                            placeholder="e.g. Asia/Colombo"
                        />
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={formData.allow_self_enrollment || false}
                            onChange={e => setFormData({ ...formData, allow_self_enrollment: e.target.checked })}
                            style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <span style={{ fontWeight: 500 }}>Allow self-enrollment (portal signups)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={formData.sms_enabled || false}
                            onChange={e => setFormData({ ...formData, sms_enabled: e.target.checked })}
                            style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <span style={{ fontWeight: 500 }}>Enable SMS Notifications</span>
                    </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                        {saving ? 'Saving...' : 'Save Policy Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
}
