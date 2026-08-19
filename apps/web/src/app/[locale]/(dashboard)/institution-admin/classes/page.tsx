'use client';
import { authManager } from '@/lib/auth-store';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { fetchClasses, deleteClass, RequestOpts } from '@/lib/api/school';
import type { ClassProfile } from '@edu-lanka/shared-types';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Plus, Loader2, XCircle, ChevronRight, Users, Star, Trash2 } from 'lucide-react';
import MultiStepModal from '@/components/ui/MultiStepModal';

export default function ClassesPage() {
    const t = useTranslations('InstitutionAdminClasses');
    const [classes, setClasses] = useState<ClassProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [classToDelete, setClassToDelete] = useState<ClassProfile | null>(null);

    const handleDeleteConfirm = async () => {
        if (!classToDelete) return;
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        await deleteClass(classToDelete.id, opts);
        setClasses(prev => prev.filter(c => c.id !== classToDelete.id));
    };

    useEffect(() => {
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        fetchClasses(opts)
            .then((data) => {
                setClasses(data);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200"
            >
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <BookOpen className="w-6 h-6 text-indigo-600" />
                            {t('title')}
                        </h1>
                        <p className="text-slate-500 mt-1">Manage and organise your school&apos;s classes and teacher assignments.</p>
                    </div>
                    <Link
                        href="/institution-admin/classes/new"
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-sm text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        {t('createClass')}
                    </Link>
                </div>

                {/* Error */}
                {error && (
                    <div className="p-4 bg-rose-50 text-rose-700 rounded-xl mb-6 border border-rose-100 flex items-center gap-3">
                        <XCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="font-medium text-sm">{error}</p>
                    </div>
                )}

                {/* Table */}
                <div className="overflow-hidden border border-slate-200 rounded-xl relative min-h-[300px]">
                    <AnimatePresence>
                        {loading && (
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center"
                            >
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <table className="w-full text-left border-collapse bg-white">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                                <th className="px-6 py-4">Class</th>
                                <th className="px-6 py-4">Section</th>
                                <th className="px-6 py-4">Year</th>
                                <th className="px-6 py-4">Medium</th>
                                <th className="px-6 py-4">Students</th>
                                <th className="px-6 py-4">Homeroom Teacher</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {!loading && classes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <BookOpen className="w-12 h-12 text-slate-300" />
                                            <p className="font-medium">{t('noClasses')}</p>
                                            <Link
                                                href="/institution-admin/classes/new"
                                                className="text-sm text-indigo-600 hover:underline font-semibold"
                                            >
                                                {t('createClass')} →
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                classes.map((cls, idx) => {
                                    const homeroomTeacher = (cls as any).class_teachers?.find((ct: any) => ct.is_homeroom);
                                    const homeroomName = homeroomTeacher?.teachers?.users?.full_name || null;
                                    const gradeName = (cls as any).grades?.name || (cls as any).grade?.name || `Grade ${(cls as any).grade ?? '?'}`;
                                    return (
                                        <motion.tr
                                            key={cls.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.04 } }}
                                            className="hover:bg-slate-50/60 transition-colors group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-sm shadow-sm">
                                                        {gradeName.toString().replace('Grade ', 'G')}
                                                    </div>
                                                    <span className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                                                        {gradeName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
                                                    {cls.section}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-medium">{cls.year}</td>
                                            <td className="px-6 py-4">
                                                {cls.medium ? (
                                                    <span className="inline-flex px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                                                        {cls.medium}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-sm italic">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-slate-700 font-medium text-sm">
                                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                                    {(cls as any).students?.length ?? 0}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {homeroomName ? (
                                                    <div className="flex items-center gap-1.5 text-slate-700 text-sm font-medium">
                                                        <Star className="w-3.5 h-3.5 text-amber-500" />
                                                        {homeroomName}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-sm italic">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        href={`/institution-admin/classes/${cls.id}?edit=true`}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-sm font-medium transition-all shadow-sm"
                                                    >
                                                        Edit
                                                    </Link>
                                                    <Link
                                                        href={`/institution-admin/classes/${cls.id}`}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded-lg text-sm font-medium transition-all shadow-sm"
                                                    >
                                                        {t('manage')}
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </Link>
                                                    <button
                                                        onClick={() => setClassToDelete(cls)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all"
                                                        title="Delete Class"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            <MultiStepModal
                isOpen={!!classToDelete}
                onClose={() => setClassToDelete(null)}
                title="Delete Class"
                steps={[
                    {
                        title: 'Are you absolutely sure?',
                        description: `This action will initiate the deletion process for the class ${classToDelete?.section}. Teachers and students will be unassigned.`,
                        confirmText: 'Yes, proceed',
                        isDestructive: true
                    },
                    {
                        title: 'Confirm Deletion',
                        description: 'Please confirm once more. This action cannot be undone.',
                        confirmText: 'Delete Class',
                        isDestructive: true
                    }
                ]}
                onComplete={handleDeleteConfirm}
            />
        </div>
    );
}
