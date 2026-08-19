'use client';
import { authManager } from '@/lib/auth-store';

import { useState, useEffect, use } from 'react';
import { fetchClass, fetchTeachers, assignTeacherToClass, removeTeacherFromClass, RequestOpts } from '@/lib/api/school';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, Users, ArrowLeft, Loader2, XCircle, CheckCircle2,
    UserCog, Plus, Trash2, Star
} from 'lucide-react';
import { Link } from '@/i18n/routing';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function ClassDetailPage({ params }: PageProps) {
    const { id } = use(params);
    const [cls, setCls] = useState<any | null>(null);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showAssignPanel, setShowAssignPanel] = useState(false);
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [isHomeroom, setIsHomeroom] = useState(false);

    const opts = (): RequestOpts => ({
        token: authManager.getToken() || '',
        tenantId: authManager.getTenantId() || '',
    });

    const refreshClass = async () => {
        try {
            const data = await fetchClass(id, opts());
            setCls(data);
        } catch (e: any) {
            setError(e.message || 'Failed to load class');
        }
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [classData, teachersData] = await Promise.all([
                    fetchClass(id, opts()),
                    fetchTeachers(opts()),
                ]);
                setCls(classData);
                setTeachers(teachersData);
            } catch (e: any) {
                setError(e.message || 'Failed to load class details');
            } finally {
                setLoading(false);
            }
        };
        load();
         
    }, [id]);

    const handleAssignTeacher = async () => {
        if (!selectedTeacherId) return;
        setActionLoading('assign');
        try {
            await assignTeacherToClass(id, { teacherId: selectedTeacherId, isHomeroom }, opts());
            setSuccess('Teacher assigned successfully');
            setShowAssignPanel(false);
            setSelectedTeacherId('');
            setIsHomeroom(false);
            await refreshClass();
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: any) {
            setError(e.message || 'Failed to assign teacher');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemoveTeacher = async (teacherId: string) => {
        setActionLoading(`remove-${teacherId}`);
        try {
            await removeTeacherFromClass(id, teacherId, opts());
            setSuccess('Teacher removed successfully');
            await refreshClass();
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: any) {
            setError(e.message || 'Failed to remove teacher');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!cls) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="p-8 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 text-center">
                    <XCircle className="w-10 h-10 mx-auto mb-3" />
                    <p className="font-semibold">{error || 'Class not found'}</p>
                    <Link href="/institution-admin/classes" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
                        ← Back to Classes
                    </Link>
                </div>
            </div>
        );
    }

    const assignedTeacherIds = new Set((cls.class_teachers || []).map((ct: any) => ct.teacher_id || ct.id));
    const availableTeachers = teachers.filter((t: any) => !assignedTeacherIds.has(t.id));

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/institution-admin/classes">
                        <span className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors inline-flex">
                            <ArrowLeft className="w-5 h-5" />
                        </span>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                            <BookOpen className="w-6 h-6 text-indigo-600" />
                            Grade {(cls.grades?.level ?? cls.grade)} — Section {cls.section}
                        </h1>
                        <p className="text-slate-500 mt-1">Academic Year {cls.year} · {cls.medium || 'No medium set'}</p>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                        { label: 'Students', value: cls.students?.length ?? 0, icon: Users },
                        { label: 'Teachers Assigned', value: (cls.class_teachers || []).length, icon: UserCog },
                        { label: 'Year', value: cls.year, icon: BookOpen },
                    ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase mb-1">
                                <Icon className="w-3.5 h-3.5" />
                                {label}
                            </div>
                            <div className="text-2xl font-bold text-slate-900">{value}</div>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Alerts */}
            <AnimatePresence>
                {success && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                        <p className="font-medium text-sm">{success}</p>
                    </motion.div>
                )}
                {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 flex items-center gap-3">
                        <XCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="font-medium text-sm">{error}</p>
                        <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600">✕</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Assigned Teachers */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <UserCog className="w-5 h-5 text-indigo-500" />
                        Assigned Teachers
                    </h2>
                    <button
                        onClick={() => setShowAssignPanel(!showAssignPanel)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Assign Teacher
                    </button>
                </div>

                {/* Assign panel */}
                <AnimatePresence>
                    {showAssignPanel && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100 overflow-hidden">
                            <p className="text-sm font-semibold text-indigo-800 mb-3">Assign a teacher to this class</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <select
                                    value={selectedTeacherId}
                                    onChange={e => setSelectedTeacherId(e.target.value)}
                                    className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">Select a teacher...</option>
                                    {availableTeachers.map((t: any) => (
                                        <option key={t.id} value={t.id}>
                                            {t.users?.full_name || t.full_name || t.id}
                                        </option>
                                    ))}
                                </select>
                                <label className="flex items-center gap-2 text-sm text-indigo-700 font-medium cursor-pointer">
                                    <input type="checkbox" checked={isHomeroom} onChange={e => setIsHomeroom(e.target.checked)}
                                        className="w-4 h-4 rounded accent-indigo-600" />
                                    Homeroom Teacher
                                </label>
                                <button
                                    onClick={handleAssignTeacher}
                                    disabled={!selectedTeacherId || actionLoading === 'assign'}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                                >
                                    {actionLoading === 'assign' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    Assign
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Teacher list */}
                {(cls.class_teachers || []).length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <UserCog className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                        <p className="text-sm">No teachers assigned yet. Click <strong>Assign Teacher</strong> to get started.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {(cls.class_teachers || []).map((ct: any) => {
                            const teacher = ct.teachers || ct;
                            const user = teacher.users || {};
                            return (
                                <div key={ct.id || ct.teacher_id}
                                    className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm">
                                            {(user.full_name || 'T').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                                                {user.full_name || '—'}
                                                {ct.is_homeroom && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold rounded-full">
                                                        <Star className="w-2.5 h-2.5" /> Homeroom
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">{user.email || ''}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveTeacher(ct.teacher_id || ct.id)}
                                        disabled={actionLoading === `remove-${ct.teacher_id || ct.id}`}
                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    >
                                        {actionLoading === `remove-${ct.teacher_id || ct.id}`
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <Trash2 className="w-4 h-4" />}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
