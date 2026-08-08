'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function ParentGradesPage() {
    const params = useParams();
    const studentId = params?.studentId as string;

    const [term, setTerm] = useState(1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [downloading, setDownloading] = useState(false);

    const [marks, setMarks] = useState<any[]>([]);

    useEffect(() => {
        const fetchMarks = async () => {
            if (!studentId) return;
            try {
                const res = await fetch(`/api/v1/student-marks/student/${studentId}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'x-tenant-id': localStorage.getItem('tenantId') || 'DEMO'
                    }
                });
                if (res.ok) {
                    const json = await res.json();
                    setMarks(json.data.filter((m: any) => m.term === term && m.academic_year === year));
                }
            } catch (e) {
                console.error("Failed to load marks", e);
            }
        };
        fetchMarks();
    }, [studentId, term, year]);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const res = await fetch(`/api/v1/report-cards/student/${studentId}/term/${term}/year/${year}/download`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'x-tenant-id': localStorage.getItem('tenantId') || 'DEMO'
                }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `report-card-${studentId}-term${term}-${year}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                alert('Report card not found or error occurred.');
            }
        } catch (e) {
            console.error(e);
            alert('Failed to download report card.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--color-brand-900)' }}>Child Report Card</h2>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 'bold', flex: 1 }}>
                    Term:
                    <select value={term} onChange={e => setTerm(Number(e.target.value))} style={{ padding: '8px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '4px' }}>
                        <option value={1}>Term 1</option>
                        <option value={2}>Term 2</option>
                        <option value={3}>Term 3</option>
                    </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 'bold', flex: 1 }}>
                    Academic Year:
                    <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '8px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </label>
            </div>

            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>View Marks</h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead>
                    <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                        <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Subject</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Score</th>
                        <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Grade</th>
                    </tr>
                </thead>
                <tbody>
                    {marks.length === 0 ? (
                        <tr>
                            <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                                No marks recorded for this term.
                            </td>
                        </tr>
                    ) : (
                        marks.map((m: any) => (
                            <tr key={m.id}>
                                <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontWeight: 500 }}>{m.subject}</td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{m.marks}</td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                                    {m.marks >= 75 ? 'A' : m.marks >= 65 ? 'B' : m.marks >= 50 ? 'C' : m.marks >= 35 ? 'S' : 'W'}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            <button
                onClick={handleDownload}
                disabled={downloading || marks.length === 0}
                style={{
                    padding: '12px 24px',
                    background: marks.length === 0 ? '#ccc' : 'var(--color-brand-700)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: marks.length === 0 ? 'not-allowed' : 'pointer',
                    width: '100%',
                    fontSize: '1rem',
                    fontWeight: 600
                }}
            >
                {downloading ? 'Downloading PDF...' : 'Download Official Report Card PDF'}
            </button>
        </div>
    );
}
