'use client';

import { useState, useEffect } from 'react';
import { fetchPolicy, updatePolicy, fetchTenant, RequestOpts } from '@/lib/api/school';
import type { SchoolPolicy, Tenant } from '@edu-lanka/shared-types';
import { motion } from 'framer-motion';
import { Settings, Save, CheckCircle2, AlertCircle, Loader2, Clock, MapPin, Building2, Languages } from 'lucide-react';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';
import { useTranslations } from 'next-intl';

export default function SchoolPolicyPage() {
    const t = useTranslations('InstitutionAdminPolicy');
    const [, setPolicy] = useState<SchoolPolicy | null>(null);
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState<Partial<SchoolPolicy>>({});

    useEffect(() => {
        const load = async () => {
            const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
            try {
                const tenantId = localStorage.getItem('tenantId') || '';
                const [policyData, tenantData] = await Promise.all([
                    fetchPolicy(opts),
                    fetchTenant(tenantId, opts)
                ]);
                setTenant(tenantData);
                setFormData(policyData || {});
            } catch (err: any) {
                setError(err.message || t('fetchError'));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(null);

        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
        try {
            // Strip out read-only fields and remap strictly to camelCase for DTO ValidationPipe
            const {
                id: _id, tenant_id: _tenant_id, created_at: _created_at, updated_at: _updated_at,
                academic_year, max_students_per_class, allow_self_enrollment,
                sms_enabled, default_language, supported_mediums,
                school_hours_start, school_hours_end, timezone
            } = formData as any;

            const dtoPayload = {
                academicYear: academic_year ? Number(academic_year) : undefined,
                maxStudentsPerClass: max_students_per_class ? Number(max_students_per_class) : undefined,
                allowSelfEnrollment: allow_self_enrollment,
                smsEnabled: sms_enabled,
                defaultLanguage: default_language,
                supportedMediums: supported_mediums,
                schoolHoursStart: school_hours_start,
                schoolHoursEnd: school_hours_end,
                timezone: timezone
            };

            // Purge undefined values
            const cleanPayload = Object.fromEntries(Object.entries(dtoPayload).filter(([_, v]) => v !== undefined));

            const updated = await updatePolicy(cleanPayload, opts);
            setPolicy(updated);
            setSuccess(t('successMsg'));
            setTimeout(() => setSuccess(null), 4000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                <p className="text-slate-500 font-medium">{t('loading')}</p>
            </div>
        );
    }

    return (
        <TutorialProvider role="SCHOOL_ADMIN" screenId="policy">
            <div className="max-w-4xl mx-auto space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 mb-8">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                                <Settings className="w-6 h-6 text-indigo-600" />
                                {t('title')}
                            </h1>
                            <p className="text-slate-500 mt-1">{t('description')}</p>
                        </div>
                    </div>

                    {error && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-4 bg-rose-50 text-rose-700 rounded-xl mb-6 border border-rose-100 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="font-medium text-sm">{error}</p>
                        </motion.div>
                    )}

                    {success && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-4 bg-emerald-50 text-emerald-700 rounded-xl mb-6 border border-emerald-100 flex items-center gap-3 shadow-sm">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                            <p className="font-medium text-sm">{success}</p>
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Box 1: Academic Settings */}
                            <div className="p-6 rounded-xl bg-slate-50 border border-slate-100 space-y-5">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                    <Building2 className="w-4 h-4 text-indigo-500" />
                                    {t('academicPreferences')}
                                </h3>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('currentAcademicYear')}</label>
                                    <input
                                        type="number"
                                        value={formData.academic_year || ''}
                                        onChange={e => setFormData({ ...formData, academic_year: parseInt(e.target.value, 10) })}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                        placeholder="e.g. 2026"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('maxStudents')}</label>
                                    <input
                                        type="number"
                                        value={formData.max_students_per_class || ''}
                                        onChange={e => setFormData({ ...formData, max_students_per_class: parseInt(e.target.value, 10) })}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                    />
                                </div>
                            </div>

                            {/* Box 2: Operations Settings */}
                            <div className="p-6 rounded-xl bg-slate-50 border border-slate-100 space-y-5">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                    <Clock className="w-4 h-4 text-emerald-500" />
                                    {t('operationalDetails')}
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('startTime')}</label>
                                        <input
                                            type="time" step="1"
                                            value={formData.school_hours_start || ''}
                                            onChange={e => setFormData({ ...formData, school_hours_start: e.target.value })}
                                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('endTime')}</label>
                                        <input
                                            type="time" step="1"
                                            value={formData.school_hours_end || ''}
                                            onChange={e => setFormData({ ...formData, school_hours_end: e.target.value })}
                                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                        {t('timezone')}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.timezone || ''}
                                        onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                        placeholder="e.g. Asia/Colombo"
                                    />
                                </div>
                            </div>

                            {/* Box 3: Localization */}
                            <div className="p-6 rounded-xl bg-slate-50 border border-slate-100 space-y-5 md:col-span-2">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                    <Languages className="w-4 h-4 text-purple-500" />
                                    {t('languageMediums')}
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('defaultLanguage')}</label>
                                        <select
                                            value={formData.default_language || 'en'}
                                            onChange={e => setFormData({ ...formData, default_language: e.target.value as 'en' | 'si' | 'ta' })}
                                            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                        >
                                            <option value="en">{t('langEn')}</option>
                                            <option value="si">{t('langSi')}</option>
                                            <option value="ta">{t('langTa')}</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('supportedMediums')}</label>
                                        <select
                                            multiple
                                            value={formData.supported_mediums || []}
                                            onChange={e => {
                                                const options = Array.from(e.target.selectedOptions);
                                                setFormData({ ...formData, supported_mediums: options.map(o => o.value as any) });
                                            }}
                                            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow min-h-[90px]"
                                        >
                                            <option value="ENGLISH">{t('medEn')}</option>
                                            <option value="SINHALA">{t('medSi')}</option>
                                            <option value="TAMIL">{t('medTa')}</option>
                                        </select>
                                        <p className="text-xs text-slate-500 mt-1.5">{t('holdCtrl')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <label className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-colors cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={formData.allow_self_enrollment || false}
                                    onChange={e => setFormData({ ...formData, allow_self_enrollment: e.target.checked })}
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div>
                                    <span className="block font-semibold text-slate-800 group-hover:text-indigo-900 transition-colors">{t('selfEnrollment')}</span>
                                    <span className="text-sm text-slate-500">{t('selfEnrollmentDesc')}</span>
                                </div>
                            </label>

                            <label className={`flex items-center gap-4 p-4 rounded-xl border transition-colors group ${!tenant?.smsApproved ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 cursor-pointer'}`}>
                                <input
                                    type="checkbox"
                                    checked={tenant?.smsApproved ? (formData.sms_enabled || false) : false}
                                    onChange={e => {
                                        if (tenant?.smsApproved) {
                                            setFormData({ ...formData, sms_enabled: e.target.checked });
                                        }
                                    }}
                                    disabled={!tenant?.smsApproved}
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                                />
                                <div>
                                    <span className="block font-semibold text-slate-800 transition-colors">
                                        {t('smsNotifications')}
                                        {!tenant?.smsApproved && (
                                            <span className="ml-2 text-[10px] uppercase font-bold tracking-wider text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
                                                System Locked
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-sm text-slate-500">
                                        {!tenant?.smsApproved
                                            ? 'Blocked by System Admin. Upgrade plan to unlock SMS features.'
                                            : t('smsNotificationsDesc')}
                                    </span>
                                </div>
                            </label>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className={`
                                flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold shadow-sm transition-all
                                ${saving
                                        ? 'bg-indigo-400 text-white cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30'}
                            `}
                            >
                                {saving ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> {t('saving')}</>
                                ) : (
                                    <><Save className="w-5 h-5" /> {t('saveConfig')}</>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
