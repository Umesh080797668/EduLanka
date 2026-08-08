'use client';

import { motion } from 'framer-motion';
import { UserPlus, ArrowLeft, Save, Briefcase, Mail, Phone, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function NewTeacherPage() {
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
                    <form className="space-y-8">
                        {/* Personal Information */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                                <Briefcase className="w-5 h-5 text-indigo-500" />
                                Personal Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Full Name</label>
                                    <input type="text" placeholder="e.g. Nimal Perera" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">National ID (NIC) *</label>
                                    <input type="text" placeholder="e.g. 198512345678" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Date of Birth</label>
                                    <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Gender</label>
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm">
                                        <option value="">Select Gender</option>
                                        <option value="MALE">Male</option>
                                        <option value="FEMALE">Female</option>
                                    </select>
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
                                        <Mail className="w-4 h-4 text-slate-400" /> Email Address
                                    </label>
                                    <input type="email" placeholder="nimal.p@school.edu" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-slate-400" /> Mobile Number
                                    </label>
                                    <input type="tel" placeholder="+94 77 123 4567" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm" />
                                </div>
                            </div>
                        </div>

                        {/* Professional details */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                                <BookOpen className="w-5 h-5 text-amber-500" />
                                Professional Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Primary Subject Area</label>
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm">
                                        <option value="">Select Subject</option>
                                        <option value="MATHEMATICS">Mathematics</option>
                                        <option value="SCIENCE">Science</option>
                                        <option value="ENGLISH">English</option>
                                        <option value="SINHALA">Sinhala</option>
                                        <option value="IT">Information Technology</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Instruction Medium</label>
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm">
                                        <option value="">Select Medium</option>
                                        <option value="SINHALA">Sinhala Medium</option>
                                        <option value="TAMIL">Tamil Medium</option>
                                        <option value="ENGLISH">English Medium</option>
                                    </select>
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
                        <button className="px-5 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                            Cancel
                        </button>
                        <button
                            className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                            onClick={(e) => { e.preventDefault(); alert('Phase 2 Form Submit Logic Triggered'); }}
                        >
                            <Save className="w-4 h-4" />
                            Create Teacher Account
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
