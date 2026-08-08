'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronDown, ChevronLeft, Loader2, Save, FileEdit, Users } from 'lucide-react';
import Link from 'next/link';

export default function TeacherGradesPage() {
    const params = useParams();
    const classId = params.classId as string;

    const [students, setStudents] = useState<any[]>([]);
    const [marks, setMarks] = useState<Record<string, { value: number | '', saving: boolean, saved: boolean }>>({});
    const [subject, setSubject] = useState('MATHEMATICS');
    const [term, setTerm] = useState(1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [pageLoading, setPageLoading] = useState(true);

    useEffect(() => {
        const loadClassDetails = async () => {
            try {
                const res = await fetch(`/api/v1/classes/${classId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'x-tenant-id': localStorage.getItem('tenantId') || 'DEMO' }
                });
                if (res.ok) {
                    const json = await res.json();
                    if (json.data && json.data.students) {
                        setStudents(json.data.students.map((st: any) => ({
                            id: st.id,
                            admissionNo: st.admission_no,
                            name: st.users?.full_name || 'Unknown'
                        })));
                    }
                }
            } catch (e) {
                console.error("Failed to fetch class roster", e);
            }
        };

        const fetchMarks = async () => {
            try {
                const res = await fetch(`/api/v1/student-marks/class/${classId}?term=${term}&year=${year}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const newMarks: Record<string, any> = {};
                    data.data?.forEach((m: any) => {
                        newMarks[m.student_id] = { value: m.marks, saving: false, saved: true };
                    });
                    setMarks(prev => ({ ...prev, ...newMarks }));
                }
            } catch (e) {
                console.error("Failed to fetch marks", e);
            }
        };

        const loadAll = async () => {
            setPageLoading(true);
            await loadClassDetails();
            await fetchMarks();
            setPageLoading(false);
        };

        loadAll();
    }, [classId, subject, term, year]);

    const handleSave = async (studentId: string) => {
        const currentMark = marks[studentId]?.value;
        if (currentMark === undefined || currentMark === '') return;

        setMarks(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: true, saved: false } }));

        try {
            const res = await fetch('/api/v1/student-marks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'x-tenant-id': localStorage.getItem('tenantId') || 'DEMO'
                },
                body: JSON.stringify({
                    studentId,
                    classId,
                    subject,
                    term,
                    academicYear: year,
                    marks: currentMark
                })
            });

            if (res.ok) {
                setMarks(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: false, saved: true } }));
                setTimeout(() => {
                    setMarks(prev => {
                        if (!prev[studentId]) return prev;
                        return { ...prev, [studentId]: { ...prev[studentId], saved: false } };
                    });
                }, 2000);
            } else {
                setMarks(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: false, saved: false } }));
                alert("Failed to save grade");
            }
        } catch (e) {
            setMarks(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: false, saved: false } }));
            alert("Error saving grade");
        }
    };

    const handleMarkChange = (studentId: string, value: string) => {
        let parsed: number | '' = value === '' ? '' : Number(value);
        if (typeof parsed === 'number' && (parsed < 0 || parsed > 100)) return; // Validate 0-100
        setMarks(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], value: parsed, saving: false, saved: false }
        }));
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <Link href="/teacher/classes" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-2">
                <ChevronLeft className="w-4 h-4" />
                Back to Classes
            </Link>

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200"
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-slate-100 pb-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <FileEdit className="w-6 h-6 text-indigo-600" />
                            Grade Entry
                        </h2>
                        <p className="text-slate-500 mt-1 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Class ID: <span className="font-semibold">{classId}</span>
                        </p>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 md:p-6 border border-slate-200 mb-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Subject</label>
                        <div className="relative">
                            <select
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg pl-4 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none transition-shadow"
                            >
                                <option value="MATHEMATICS">Mathematics</option>
                                <option value="SCIENCE">Science</option>
                                <option value="ENGLISH">English</option>
                                <option value="SINHALA">Sinhala</option>
                            </select>
                            <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-500 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Academic Term</label>
                        <div className="relative">
                            <select
                                value={term}
                                onChange={e => setTerm(Number(e.target.value))}
                                className="w-full bg-white border border-slate-300 rounded-lg pl-4 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none transition-shadow"
                            >
                                <option value={1}>Term 1</option>
                                <option value={2}>Term 2</option>
                                <option value={3}>Term 3</option>
                            </select>
                            <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-500 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Academic Year</label>
                        <input
                            type="number"
                            value={year}
                            onChange={e => setYear(Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                        />
                    </div>
                </div>

                <div className="overflow-hidden border border-slate-200 rounded-xl relative min-h-[300px]">
                    <AnimatePresence>
                        {pageLoading && (
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

                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                                <th className="px-6 py-4 w-32">Index No</th>
                                <th className="px-6 py-4">Student Name</th>
                                <th className="px-6 py-4 w-40 text-center">Marks (out of 100)</th>
                                <th className="px-6 py-4 w-32 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {!pageLoading && students.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        No students found in this class.
                                    </td>
                                </tr>
                            ) : (
                                students.map((s, idx) => {
                                    const state = marks[s.id] || { value: '', saving: false, saved: false };
                                    return (
                                        <motion.tr
                                            key={s.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                                            className="hover:bg-slate-50/50 transition-colors"
                                        >
                                            <td className="px-6 py-3 text-slate-500 font-mono text-sm">{s.admissionNo}</td>
                                            <td className="px-6 py-3 font-medium text-slate-800">{s.name}</td>
                                            <td className="px-6 py-3 flex justify-center">
                                                <input
                                                    type="number"
                                                    min="0" max="100"
                                                    value={state.value}
                                                    onChange={e => handleMarkChange(s.id, e.target.value)}
                                                    className="w-20 text-center bg-white border border-slate-300 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                                    placeholder="-"
                                                />
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <button
                                                    onClick={() => handleSave(s.id)}
                                                    disabled={state.saving || state.value === ''}
                                                    className={`
                                                        px-3 py-1.5 rounded-md text-sm font-semibold flex items-center justify-center mx-auto gap-2 min-w-[80px] transition-all
                                                        ${state.saving
                                                            ? 'bg-indigo-100 text-indigo-600'
                                                            : state.saved
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : state.value === ''
                                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                                                        }
                                                    `}
                                                >
                                                    {state.saving ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : state.saved ? (
                                                        <><CheckCircle2 className="w-4 h-4" /> Saved</>
                                                    ) : (
                                                        <><Save className="w-4 h-4" /> Save</>
                                                    )}
                                                </button>
                                            </td>
                                        </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}

