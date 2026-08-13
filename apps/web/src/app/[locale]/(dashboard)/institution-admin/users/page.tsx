'use client';

import { useState, useEffect } from 'react';
import { fetchUsers, setUserActive, updateUser, RequestOpts } from '@/lib/api/school';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Loader2, ShieldCheck, CheckCircle2, XCircle, MoreVertical, Edit2 } from 'lucide-react';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

export default function UsersPage() {
    const t = useTranslations('InstitutionAdminUsers');
    const searchParams = useSearchParams();
    const [users, setUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState(searchParams?.get('query') || '');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [userToConfirm, setUserToConfirm] = useState<any | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [userToEdit, setUserToEdit] = useState<any | null>(null);
    const [editForm, setEditForm] = useState({ fullName: '', phoneNumber: '', avatarUrl: '' });

    const refreshUsers = () => {
        setLoading(true);
        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
        fetchUsers(undefined, opts) // List all users
            .then(setUsers)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        refreshUsers();
    }, []);

    useEffect(() => {
        const query = searchParams?.get('query');
        if (query) setSearchQuery(query);
    }, [searchParams]);

    const toggleUserStatus = async () => {
        if (!userToConfirm) return;
        const user = userToConfirm;
        if (user.role === 'SCHOOL_ADMIN') return;

        setActionLoading(user.id);
        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
        try {
            await setUserActive(user.id, !user.is_active, opts);
            await refreshUsers();
            setUserToConfirm(null);
        } catch (e: any) {
            setError(e.message || 'Failed to update user status');
        } finally {
            setActionLoading(null);
        }
    };

    const handleActionClick = (user: any) => {
        setUserToConfirm(user); // Force confirmation step explicitly for drops/adds
    };

    const handleEditClick = (user: any) => {
        setUserToEdit(user);
        setEditForm({ fullName: user.full_name || '', phoneNumber: user.phone_number || '', avatarUrl: user.avatar_url || '' });
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userToEdit) return;
        setActionLoading(`edit-${userToEdit.id}`);
        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
        try {
            await updateUser(userToEdit.id, { fullName: editForm.fullName, phoneNumber: editForm.phoneNumber || undefined, avatarUrl: editForm.avatarUrl || undefined }, opts);
            await refreshUsers();
            setUserToEdit(null);
        } catch (e: any) {
            setError(e.message || 'Failed to update user details');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredUsers = users.filter(u =>
        (u.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    return (
        <TutorialProvider role="SCHOOL_ADMIN" screenId="users">
            <div className="max-w-6xl mx-auto space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                                <Users className="w-6 h-6 text-indigo-600" />
                                {t('userManagement')}
                            </h1>
                            <p className="text-slate-500 mt-1">{t('userManagementDesc')}</p>
                        </div>
                        <div className="relative max-w-sm w-full">
                            <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('searchPlaceholder')}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {error && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-rose-50 text-rose-700 rounded-xl mb-6 border border-rose-100 flex items-center gap-3">
                            <XCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="font-medium text-sm">{error}</p>
                        </motion.div>
                    )}

                    <div className="overflow-hidden border border-slate-200 rounded-xl relative min-h-[400px]">
                        <AnimatePresence>
                            {loading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center pointer-events-none"
                                >
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <AnimatePresence>
                            {userToConfirm && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center"
                                    >
                                        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <ShieldCheck className="w-8 h-8" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                                            {userToConfirm.is_active ? 'Deactivate Account' : 'Reactivate Account'}
                                        </h3>
                                        <p className="text-slate-500 mb-6">
                                            You are about to {userToConfirm.is_active ? 'deactivate' : 'reactivate'} the authorization profile for <span className="font-semibold text-slate-700">{userToConfirm.full_name}</span>.
                                            {userToConfirm.is_active && ' They will be immediately disconnected from all authenticated sessions.'}
                                        </p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setUserToConfirm(null)}
                                                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={toggleUserStatus}
                                                disabled={actionLoading === userToConfirm.id}
                                                className={`flex-1 px-4 py-2 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${userToConfirm.is_active
                                                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                                                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                                    }`}
                                            >
                                                {actionLoading === userToConfirm.id ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    userToConfirm.is_active ? 'Confirm Deactivation' : 'Confirm Reactivation'
                                                )}
                                            </button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>

                        {/* Edit User Modal */}
                        <AnimatePresence>
                            {userToEdit && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
                                    >
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                                <Edit2 className="w-5 h-5 text-indigo-500" />
                                                Edit Authentication Profile
                                            </h3>
                                            <button onClick={() => setUserToEdit(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <form onSubmit={handleEditSubmit} className="space-y-4 text-left">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={editForm.fullName}
                                                    onChange={e => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                                <input
                                                    type="text"
                                                    value={editForm.phoneNumber}
                                                    onChange={e => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Avatar URL</label>
                                                <input
                                                    type="url"
                                                    value={editForm.avatarUrl}
                                                    placeholder="https://..."
                                                    onChange={e => setEditForm(prev => ({ ...prev, avatarUrl: e.target.value }))}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                                {editForm.avatarUrl && (
                                                    <img
                                                        src={editForm.avatarUrl}
                                                        alt="Avatar preview"
                                                        className="mt-2 w-12 h-12 rounded-full object-cover border-2 border-indigo-200"
                                                        onError={e => (e.currentTarget.style.display = 'none')}
                                                    />
                                                )}
                                            </div>
                                            <div className="pt-4 flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setUserToEdit(null)}
                                                    className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={actionLoading === `edit-${userToEdit.id}`}
                                                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                                                >
                                                    {actionLoading === `edit-${userToEdit.id}` ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                                                </button>
                                            </div>
                                        </form>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>

                        <table className="w-full text-left border-collapse bg-white">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                                    <th className="px-6 py-4">{t('nameEmail')}</th>
                                    <th className="px-6 py-4">{t('role')}</th>
                                    <th className="px-6 py-4">{t('status')}</th>
                                    <th className="px-6 py-4 text-right">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {!loading && filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Users className="w-10 h-10 text-slate-300" />
                                                <p>{searchQuery ? 'No users matching search.' : t('noUsers')}</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user, idx) => (
                                        <motion.tr
                                            key={user.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                                            className="hover:bg-slate-50/60 transition-colors group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border border-indigo-100">
                                                        {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">{user.full_name}</div>
                                                        <div className="text-sm text-slate-500">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold capitalize">
                                                    {user.role === 'ADMIN' && <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />}
                                                    {user.role.toLowerCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border
                                                ${user.is_active
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-rose-50 text-rose-700 border-rose-200'}
                                            `}>
                                                    {user.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                    {user.is_active ? t('active') : t('deactivated')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 relative">
                                                    {user.role !== 'SCHOOL_ADMIN' && (
                                                        <div className="relative">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveDropdown(activeDropdown === user.id ? null : user.id);
                                                                }}
                                                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white shadow-sm"
                                                            >
                                                                <MoreVertical className="w-5 h-5" />
                                                            </button>

                                                            <AnimatePresence>
                                                                {activeDropdown === user.id && (
                                                                    <>
                                                                        <div className="fixed inset-0 z-30" onClick={() => setActiveDropdown(null)} />
                                                                        <motion.div
                                                                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                            exit={{ opacity: 0, scale: 0.95 }}
                                                                            className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden flex flex-col"
                                                                        >
                                                                            <button onClick={() => { setActiveDropdown(null); handleActionClick(user); }} className={`px-4 py-3 text-sm text-left hover:bg-slate-50 border-b border-slate-100 font-medium ${user.is_active ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                                {user.is_active ? t('deactivate') : t('reactivate')}
                                                                            </button>
                                                                            <button onClick={() => { setActiveDropdown(null); handleEditClick(user); }} className="px-4 py-3 text-sm text-left hover:bg-slate-50 font-medium text-slate-600">
                                                                                Edit Account Profile
                                                                            </button>
                                                                        </motion.div>
                                                                    </>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
