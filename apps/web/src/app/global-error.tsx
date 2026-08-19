'use client';
import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Fatal Next.js root error:', error);
    }, [error]);

    return (
        <html>
            <body>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', margin: 0 }}>
                    <div style={{ textAlign: 'center', maxWidth: '32rem', padding: '2rem', backgroundColor: '#fff', borderRadius: '1rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
                        <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '1rem' }}>Global Application Error</h2>
                        <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: '1.5' }}>
                            A critical boundary fault has occurred outside of the localized routing tree.
                        </p>
                        <button
                            onClick={() => reset()}
                            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer' }}
                        >
                            Try Recovery
                        </button>
                    </div>
                </div>
            </body>
        </html>
    )
}
