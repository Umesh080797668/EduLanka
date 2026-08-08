'use client';

import { useState, useEffect } from 'react';
import { fetchGrades, updateGrade, RequestOpts } from '@/lib/api/school';
import type { GradeProfile } from '@edu-lanka/shared-types';

export default function GradesPage() {
    const [grades, setGrades] = useState<GradeProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const opts: RequestOpts = { token: 'DEMO', tenantId: 'DEMO' };
            const data = await fetchGrades(opts);
            setGrades(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const toggleStatus = async (id: string, current: boolean) => {
        try {
            const opts: RequestOpts = { token: 'DEMO', tenantId: 'DEMO' };
            await updateGrade(id, { isActive: !current }, opts);
            await loadData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Curriculum Grades Matrix</h1>
            </div>

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading grades...</div>
            ) : error ? (
                <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px' }}>
                    {error}
                </div>
            ) : grades.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No grades initialized.</p>
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>Level Context</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>Curriculum Phase</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151', textAlign: 'right' }}>Status Toggle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grades.map((grade) => (
                                <tr key={grade.id} style={{ borderBottom: '1px solid #e5e7eb', opacity: grade.is_active ? 1 : 0.6 }}>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div style={{ fontWeight: 500 }}>{grade.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Level {grade.level}</div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <span style={{ background: '#f3f4f6', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 500 }}>
                                            {grade.curriculum_type.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                        <button
                                            onClick={() => toggleStatus(grade.id, grade.is_active)}
                                            style={{
                                                background: grade.is_active ? '#fee2e2' : '#d1fae5',
                                                color: grade.is_active ? '#b91c1c' : '#065f46',
                                                border: 'none',
                                                padding: '0.4rem 0.8rem',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontWeight: 500,
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            {grade.is_active ? 'Deactivate' : 'Reactivate'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
