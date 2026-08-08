'use client';

import { motion } from 'framer-motion';
import { UserPlus, ArrowLeft, Save, Briefcase, Mail, Phone, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewTeacherPage() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // A temporary password matching the standard procedure or handled server side
            // In a real flow, a secure generator would be used
            const tempPassword = 'EduLankaTeacher!2026';

            const res = await fetch('/api/v1/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'x-tenant-id': localStorage.getItem('tenantId') || ''
                },
                body: JSON.stringify({
                    email,
                    fullName,
                    password: tempPassword,
                    role: 'TEACHER'
                })
            });

            if (res.ok) {
                router.push('/admin/users');
            } else {
                const data = await res.json();
                setError(data.message || 'Failed to provision teacher account.');
            }
        } catch (err: any) {
            setError(err.message || 'Error executing request.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/users">
                    <button className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        <UserPlus className="w-6 h-6 text-indigo-600" />
                        Add New Teacher
                    </h2>
                    <p className="text-slate-500 mt-1">Create a new teacher profile and generate login credentials.</p>
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
                                Personal Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Full Name *</label>
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
                                    <label className="text-sm font-medium text-slate-700">National ID (NIC)</label>
                                    <input type="text" placeholder="e.g. 198512345678" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm" />
                                </div>
                            </div>
                        </div>

                        {/* Contact Information */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                                <Phone className="w-5 h-5 text-emerald-500" />
                                Contact Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-slate-400" /> Email Address *
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
                                        <Phone className="w-4 h-4 text-slate-400" /> Mobile Number
                                    </label>
                                    <input type="tel" placeholder="+94 77 123 4567" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm" />
                                </div>
                            </div>
                        </div>

                    </form>
                </div>
                <div className="bg-slate-50 py-4 px-8 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                        An initial password will be automatically generated and emailed to the teacher.
                    </p>
                    <div className="flex gap-3">
                        <Link href="/admin/users">
                            <button className="px-5 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                                Cancel
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
                            Create Teacher Account
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
