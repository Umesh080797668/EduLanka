'use client';

import { motion } from 'framer-motion';
import { UserPlus, ArrowLeft, Save, Briefcase, Mail, Phone, Loader2, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useTranslations } from 'next-intl';
import ImageUpload from '@/components/ui/ImageUpload';

export default function NewTeacherPage() {
    const t = useTranslations('InstitutionAdminTeachers');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
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

            await apiClient.post<any>('/teachers', {
                email,
                fullName,
                avatarUrl,
                temporaryPassword: tempPassword
            }, { skipGlobalToast: true });

            import('sonner').then(({ toast }) => {
                toast.success(t('accountProvisioned') || 'Account Provisioned', {
                    description: t('profileCreated') || 'The teacher profile was created successfully.'
                });
            });
            setSuccessData({ email, tempPassword });
        } catch (err: any) {
            const msg = err.message || 'Error executing request.';
            setError(msg);
            import('sonner').then(({ toast }) => {
                toast.error('Provisioning Failed', { description: msg });
            });
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
                    <div className="p-10 pb-8 bg-emerald-600 text-white">
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mx-auto flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight mb-2">{t('accountProvisioned')}</h2>
                        <p className="text-emerald-100 font-medium">{t('profileCreated')}</p>
                    </div>

                    <div className="p-10">
                        <p className="text-slate-600 mb-6">
                            {t('provideTemp')}
                        </p>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 max-w-md mx-auto space-y-4 text-left">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">{t('loginEmail')}</label>
                                <div className="text-slate-800 font-mono font-medium text-lg bg-white border border-slate-200 px-4 py-2 rounded-lg">{successData.email}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">{t('tempPassword')}</label>
                                <div className="flex items-center gap-2">
                                    <div className="text-slate-800 font-mono font-bold text-xl bg-white border border-slate-200 px-4 py-2 rounded-lg flex-1">
                                        {successData.tempPassword}
                                    </div>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(successData.tempPassword)}
                                        className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                                        title={t('copyPassword')}
                                    >
                                        <Copy className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 pt-8 border-t border-slate-100 flex gap-4 justify-center">
                            <button
                                onClick={() => {
                                    setFullName('');
                                    setEmail('');
                                    setSuccessData(null);
                                }}
                                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                            >
                                {t('addAnother')}
                            </button>
                            <Link href="/institution-admin/teachers">
                                <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-sm">
                                    {t('returnDirectory')}
                                </button>
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/institution-admin/teachers">
                    <button className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        <UserPlus className="w-6 h-6 text-indigo-600" />
                        {t('addNewTeacher')}
                    </h2>
                    <p className="text-slate-500 mt-1">{t('createNewProfile')}</p>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
            >
                <div className="p-8">
                    {error && (
                        <div className="p-4 bg-rose-50 text-rose-700 rounded-xl mb-6 border border-rose-100 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="font-medium text-sm">{error}</p>
                        </div>
                    )}

                    <form id="teacherForm" onSubmit={handleSubmit} className="space-y-8">
                        {/* Personal Information */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                                <Briefcase className="w-5 h-5 text-indigo-500" />
                                {t('personalInfo')}
                            </h3>

                            <div className="flex items-center gap-4 mb-6">
                                <ImageUpload
                                    currentImageUrl={avatarUrl}
                                    onUploadSuccess={setAvatarUrl}
                                    onError={(err) => alert(err)}
                                    size={80}
                                    className="shrink-0"
                                />
                                <div className="text-sm text-slate-500">
                                    <p className="font-semibold text-slate-700">Profile Picture</p>
                                    <p>Upload a square image (JPEG/PNG) to serve as the teacher's avatar.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">{t('fullName')}</label>
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="e.g. Nimal Perera"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">{t('nic')}</label>
                                    <input type="text" placeholder="e.g. 198512345678" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm" />
                                </div>
                            </div>
                        </div>

                        {/* Contact Information */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                                <Phone className="w-5 h-5 text-emerald-500" />
                                {t('contactDetails')}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-slate-400" /> {t('emailAddress')}
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="nimal.p@school.edu"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-slate-400" /> {t('mobileNumber')}
                                    </label>
                                    <input type="tel" placeholder="+94 77 123 4567" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm" />
                                </div>
                            </div>
                        </div>

                    </form>
                </div>
                <div className="bg-slate-50 py-4 px-8 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                        {t('securePasswordGen')}
                    </p>
                    <div className="flex gap-3">
                        <Link href="/institution-admin/teachers">
                            <button className="px-5 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                                {t('cancel')}
                            </button>
                        </Link>
                        <button
                            type="submit"
                            form="teacherForm"
                            disabled={loading || !fullName || !email}
                            className={`
                                px-6 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2
                                ${loading || !fullName || !email ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}
                            `}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {t('createAccount')}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
