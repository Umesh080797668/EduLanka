'use client';

import { useState, useEffect } from 'react';
import { fetchUsers, RequestOpts } from '@/lib/api/school';


export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const opts: RequestOpts = { token: 'DEMO', tenantId: 'DEMO' };
        fetchUsers(undefined, opts) // List all users
            .then(setUsers)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>User Management</h1>
            </div>

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading users...</div>
            ) : error ? (
                <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px' }}>
                    {error}
                </div>
            ) : users.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No users found.</p>
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>Name & Email</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>Role</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151' }}>Status</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#374151', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div style={{ fontWeight: 500 }}>{user.full_name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{user.email}</div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <span style={{
                                            background: '#f3f4f6',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                            color: '#374151'
                                        }}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                            background: user.is_active ? '#dcfce7' : '#fee2e2',
                                            color: user.is_active ? '#166534' : '#991b1b'
                                        }}>
                                            {user.is_active ? 'Active' : 'Deactivated'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                        <button
                                            style={{
                                                padding: '0.375rem 0.75rem',
                                                borderRadius: '4px',
                                                border: '1px solid #d1d5db',
                                                background: 'white',
                                                color: '#374151',
                                                cursor: 'pointer',
                                                fontSize: '0.875rem'
                                            }}
                                            onClick={() => alert('Phase 1: Status toggle logic goes here')}
                                        >
                                            {user.is_active ? 'Deactivate' : 'Reactivate'}
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
