'use client';

import { motion } from 'framer-motion';
import { UserPlus, ArrowLeft, Save, Mail, Phone, Loader2, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function NewParentPage() {
    const t = useTranslations('InstitutionAdminParents');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successData, setSuccessData] = useState<{ email: string, tempPassword: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Generate a secure temporary password
            const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase() + '!';

            const payload: any = {
                email,
                fullName,
                temporaryPassword: tempPassword
            };
            if (phoneNumber) payload.phoneNumber = phoneNumber;

            const res = await fetch('/api/v1/parents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'x-tenant-id': localStorage.getItem('tenantId') || 'a1b2c3d4-0000-0000-0000-000000000001'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setSuccessData({ email, tempPassword });
            } else {
                const data = await res.json();
                setError(data.message || 'Failed to provision parent account.');
            }
        } catch (err: any) {
            setError(err.message || 'Error executing request.');
        } finally {
            setLoading(false);
        }
    };

    if (successData) {
        return (
            <div className="max-w-3xl mx-auto mt-12">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-center"
                >
                    <div className="bg-emerald-500 p-8 text-white flex flex-col items-center justify-center">
                        <CheckCircle2 className="w-16 h-16 mb-4 opacity-90" />
                        <h2 className="text-2xl font-bold">{t('accountProvisioned')}</h2>
                        <p className="text-emerald-50 mt-2">{t('profileCreated')}</p>
                    </div>

                    <div className="p-8 pb-10">
                        <p className="text-slate-600 mb-6 max-w-lg mx-auto">
                            {t('provideTemp')}
                        </p>

                        <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-xl p-6 sm:px-8 mb-8 text-left shadow-sm">
                            <div className="mb-4">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('loginEmail')}</label>
                                <div className="text-slate-800 font-medium text-lg mt-1">{successData.email}</div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('tempPassword')}</label>
                                <div className="flex items-center gap-3 mt-1">
                                    <code className="flex-1 bg-white border border-slate-200 text-slate-800 px-3 py-2 rounded-lg font-mono text-lg truncate">
                                        {successData.tempPassword}
                                    </code>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(successData.tempPassword)}
                                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent rounded-lg transition-colors"
                                        title={t('copyPassword')}
                                    >
                                        <Copy className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={() => {
                                    setSuccessData(null);
                                    setFullName('');
                                    setEmail('');
                                    setPhoneNumber('');
                                }}
                                className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors w-full sm:w-auto"
                            >
                                {t('addAnother')}
                            </button>
                            <Link
                                href="/institution-admin/parents"
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors w-full sm:w-auto"
                            >
                                {t('returnDirectory')}
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <Link
                href="/institution-admin/parents"
                className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 transition-colors group"
            >
                <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-0.5 transition-transform" />
                {t('returnDirectory')}
            </Link>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-8 md:px-8 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                            <UserPlus className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('createNewParent')}</h1>
                            <p className="text-slate-500 mt-1 text-sm">{t('createNewProfile')}</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 md:p-8">
                    {error && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6">
                            <div className="p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 flex gap-3 text-sm">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p className="font-medium">{error}</p>
                            </div>
                        </motion.div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Column 1 */}
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">{t('personalInfo')}</h2>
                                <div className="space-y-4 shadow-sm border border-slate-100 p-5 rounded-xl bg-slate-50/30">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('fullName')}</label>
                                        <input
                                            type="text"
                                            required
                                            value={fullName}
                                            onChange={e => setFullName(e.target.value)}
                                            placeholder="e.g. Nimal Perera"
                                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm outline-none transition-all placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">{t('contactDetails')}</h2>
                                <div className="space-y-4 shadow-sm border border-slate-100 p-5 rounded-xl bg-slate-50/30">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('emailAddress')} (Optional)</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                                <Mail className="h-4 w-4" />
                                            </div>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                placeholder="nimal@example.com"
                                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm outline-none transition-all placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('mobileNumber')}</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                                <Phone className="h-4 w-4" />
                                            </div>
                                            <input
                                                type="text"
                                                value={phoneNumber}
                                                onChange={e => setPhoneNumber(e.target.value)}
                                                placeholder="e.g. +94771234567"
                                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm outline-none transition-all placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3 mb-6">
                            <AlertCircle className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-indigo-900 font-medium leading-relaxed">
                                {t('securePasswordGen')}
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <Link
                                href="/institution-admin/parents"
                                className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                {t('cancel')}
                            </Link>
                            <button
                                type="submit"
                                disabled={loading || !fullName || (!email && !phoneNumber)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-sm"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {t('createAccount')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
