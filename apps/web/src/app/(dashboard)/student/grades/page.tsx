'use client';

import { useState } from 'react';

export default function StudentGradesPage() {
    const studentId = 'my-student-id'; // In reality derived from JwtPayload session

    const [term, setTerm] = useState(1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const res = await fetch(`/api/v1/report-cards/student/${studentId}/term/${term}/year/${year}/download`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `report-card-term${term}-${year}.txt`;
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
        <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--color-brand-900)' }}>My Report Cards</h2>

            <p style={{ marginBottom: '1.5rem' }}>Select a term and academic year to download your official report card.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 'bold' }}>
                    Term:
                    <select value={term} onChange={e => setTerm(Number(e.target.value))} style={{ padding: '8px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '4px' }}>
                        <option value={1}>Term 1</option>
                        <option value={2}>Term 2</option>
                        <option value={3}>Term 3</option>
                    </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 'bold' }}>
                    Academic Year:
                    <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '8px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </label>
            </div>

            <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                    padding: '12px 24px',
                    background: 'var(--color-brand-600)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    width: '100%',
                    fontSize: '1rem',
                    fontWeight: 600
                }}
            >
                {downloading ? 'Generating...' : 'Download Report Card'}
            </button>
        </div>
    );
}

