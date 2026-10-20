'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Calendar,
    CheckCircle2,
    Clock,
    FileCheck2,
    Info,
    RefreshCw,
    Save,
    UserCheck,
    UserX,
    Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

interface StudentRosterItem {
    studentId: string;
    studentRecordId: string;
    admissionNumber: string;
    fullName: string;
    email?: string;
    status: AttendanceStatus | null;
    markedAt?: string | null;
    markedBy?: string | null;
}

interface AttendanceSummary {
    totalStudents: number;
    totalMarked: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    unmarked: number;
    attendanceRate: number;
}

export default function TeacherAttendancePage() {
    const t = useTranslations('Attendance');
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().slice(0, 10),
    );

    const [students, setStudents] = useState<StudentRosterItem[]>([]);
    const [summary, setSummary] = useState<AttendanceSummary | null>(null);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [loadingRoster, setLoadingRoster] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // 1. Fetch teacher classes on load
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const user = await apiClient.get<any>('/users/me');
                if (user?.id) {
                    const data = await apiClient.get<any[]>(`/classes?teacherId=${user.id}`);
                    const list = data || [];
                    setClasses(list);
                    if (list.length > 0) {
                        setSelectedClassId(list[0].id);
                    }
                }
            } catch (err: any) {
                console.error('Failed to load teacher classes:', err);
                setErrorMessage(err?.message || 'Failed to load assigned classes');
            } finally {
                setLoadingClasses(false);
            }
        };

        fetchClasses();
    }, []);

    // 2. Fetch class attendance roster when class or date changes
    useEffect(() => {
        if (!selectedClassId) return;

        const fetchRoster = async () => {
            setLoadingRoster(true);
            setSuccessMessage(null);
            setErrorMessage(null);
            setIsDirty(false);
            try {
                const res = await apiClient.get<{
                    class: any;
                    date: string;
                    summary: AttendanceSummary;
                    students: StudentRosterItem[];
                }>(`/attendance?classId=${selectedClassId}&date=${selectedDate}`);

                setStudents(res.students || []);
                setSummary(res.summary);
            } catch (err: any) {
                console.error('Failed to load attendance roster:', err);
                setErrorMessage(err?.message || 'Failed to retrieve attendance roster');
                setStudents([]);
                setSummary(null);
            } finally {
                setLoadingRoster(false);
            }
        };

        fetchRoster();
    }, [selectedClassId, selectedDate]);

    // Update single student attendance status in local state
    const handleStatusChange = (studentId: string, newStatus: AttendanceStatus) => {
        setStudents((prev) =>
            prev.map((s) => (s.studentId === studentId ? { ...s, status: newStatus } : s)),
        );
        setIsDirty(true);
        recalcSummary(
            students.map((s) => (s.studentId === studentId ? { ...s, status: newStatus } : s)),
        );
    };

    // Quick shortcut: Mark all unmarked or absent as PRESENT
    const handleMarkAllPresent = () => {
        setStudents((prev) => prev.map((s) => ({ ...s, status: 'PRESENT' })));
        setIsDirty(true);
        recalcSummary(students.map((s) => ({ ...s, status: 'PRESENT' })));
    };

    // Live update summary counters
    const recalcSummary = (roster: StudentRosterItem[]) => {
        let p = 0,
            a = 0,
            l = 0,
            e = 0,
            u = 0;
        for (const s of roster) {
            if (s.status === 'PRESENT') p++;
            else if (s.status === 'ABSENT') a++;
            else if (s.status === 'LATE') l++;
            else if (s.status === 'EXCUSED') e++;
            else u++;
        }
        const total = roster.length;
        const marked = p + a + l + e;
        const rate = total > 0 ? Math.round(((p + l) / total) * 100) : 0;

        setSummary({
            totalStudents: total,
            totalMarked: marked,
            present: p,
            absent: a,
            late: l,
            excused: e,
            unmarked: u,
            attendanceRate: rate,
        });
    };

    // Save attendance roll call to backend
    const handleSaveAttendance = async () => {
        if (!selectedClassId || students.length === 0) return;
        setSaving(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const recordsToSave = students
                .filter((s) => s.status !== null)
                .map((s) => ({
                    studentId: s.studentId,
                    status: s.status as AttendanceStatus,
                }));

            if (recordsToSave.length === 0) {
                setErrorMessage('Please mark attendance for at least one student before saving.');
                setSaving(false);
                return;
            }

            await apiClient.post('/attendance', {
                classId: selectedClassId,
                date: selectedDate,
                records: recordsToSave,
            });

            setIsDirty(false);
            setSuccessMessage(`Attendance saved successfully for ${recordsToSave.length} students.`);
        } catch (err: any) {
            console.error('Failed to save attendance:', err);
            setErrorMessage(err?.message || 'Failed to save attendance roll call.');
        } finally {
            setSaving(false);
        }
    };

    if (loadingClasses) {
        return (
            <div className="mx-auto max-w-6xl space-y-6">
                <PageSkeleton />
            </div>
        );
    }

    if (classes.length === 0) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader
                    icon={<UserCheck />}
                    title={t('title')}
                    description={t('subtitle')}
                />
                <EmptyState
                    icon={<Users className="h-10 w-10 text-muted-foreground" />}
                    title={t('noClassesTitle')}
                    description={t('noClassesDescription')}
                />
            </div>
        );
    }

    return (
        <TutorialProvider role="TEACHER" screenId="attendance">
            <div className="mx-auto max-w-6xl space-y-6">
                <PageHeader
                    icon={<UserCheck className="text-primary" />}
                    title={t('title')}
                    description={t('subtitle')}
                    badge={
                        summary ? (
                            <Badge tone={summary.attendanceRate >= 80 ? 'success' : 'warning'}>
                                {summary.attendanceRate}% {t('presentRate')}
                            </Badge>
                        ) : undefined
                    }
                />

                {/* Notification Alerts */}
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400"
                    >
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <span>{successMessage}</span>
                    </motion.div>
                )}

                {errorMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400"
                    >
                        <Info className="h-5 w-5 shrink-0" />
                        <span>{errorMessage}</span>
                    </motion.div>
                )}

                {/* Controls Bar: Class selector, Date picker, Quick Mark, Save */}
                <Card id="attendance-controls" className="border border-border/60 shadow-sm backdrop-blur-md">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Class Dropdown */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {t('class')}
                                    </label>
                                    <select
                                        id="attendance-class-select"
                                        value={selectedClassId}
                                        onChange={(e) => setSelectedClassId(e.target.value)}
                                        className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        {classes.map((cls) => (
                                            <option key={cls.id} value={cls.id}>
                                                {cls.name || `Grade ${cls.grades?.level ?? cls.grade ?? ''} - ${cls.section ?? ''}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date Picker */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {t('date')}
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="attendance-date-picker"
                                            type="date"
                                            value={selectedDate}
                                            max={new Date().toISOString().slice(0, 10)}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 pt-2 md:pt-0">
                                <Button
                                    id="attendance-quick-mark-btn"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleMarkAllPresent}
                                    disabled={loadingRoster || students.length === 0}
                                    className="gap-1.5"
                                >
                                    <FileCheck2 className="h-4 w-4 text-emerald-500" />
                                    {t('markAllPresent')}
                                </Button>

                                <Button
                                    id="attendance-save-btn"
                                    variant="primary"
                                    size="sm"
                                    onClick={handleSaveAttendance}
                                    disabled={saving || loadingRoster || students.length === 0 || !isDirty}
                                    className={cn('gap-2 shadow-md transition-all', isDirty && 'ring-2 ring-primary ring-offset-2')}
                                >
                                    {saving ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            {t('saving')}
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4" />
                                            {t('saveRoster')}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Stat Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <Card className="border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                {t('present')}
                            </div>
                            <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                                {summary.present}
                            </div>
                        </Card>

                        <Card className="border border-rose-500/20 bg-rose-500/5 p-4 text-center">
                            <div className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                {t('absent')}
                            </div>
                            <div className="mt-1 text-2xl font-bold text-rose-700 dark:text-rose-300">
                                {summary.absent}
                            </div>
                        </Card>

                        <Card className="border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                            <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                {t('late')}
                            </div>
                            <div className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">
                                {summary.late}
                            </div>
                        </Card>

                        <Card className="border border-sky-500/20 bg-sky-500/5 p-4 text-center">
                            <div className="text-xs font-medium text-sky-600 dark:text-sky-400">
                                {t('excused')}
                            </div>
                            <div className="mt-1 text-2xl font-bold text-sky-700 dark:text-sky-300">
                                {summary.excused}
                            </div>
                        </Card>

                        <Card className="col-span-2 border border-border/80 bg-muted/30 p-4 text-center sm:col-span-1">
                            <div className="text-xs font-medium text-muted-foreground">
                                {t('unmarked')}
                            </div>
                            <div className="mt-1 text-2xl font-bold text-foreground">
                                {summary.unmarked}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Student Roll Call Table */}
                <Card id="attendance-roster-table" className="border border-border/70 shadow-sm">
                    <CardHeader className="border-b border-border/50 pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold">
                                <Users className="h-5 w-5 text-primary" />
                                {t('studentRoster')} ({students.length})
                            </CardTitle>
                            {isDirty && (
                                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                    {t('unsavedChanges')}
                                </span>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loadingRoster ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <RefreshCw className="mx-auto h-8 w-8 animate-spin opacity-50" />
                                <p className="mt-2 text-sm">{t('loadingRoster')}</p>
                            </div>
                        ) : students.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground">
                                <Users className="mx-auto h-10 w-10 opacity-30" />
                                <p className="mt-2 text-sm">{t('noStudentsEnrolled')}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/40">
                                {students.map((student, idx) => (
                                    <div
                                        key={student.studentId}
                                        className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        {/* Student Info */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground">
                                                    {student.fullName}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {t('admNo')}: {student.admissionNumber || 'N/A'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Buttons */}
                                        <div className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center sm:gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleStatusChange(student.studentId, 'PRESENT')}
                                                className={cn(
                                                    'flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                                                    student.status === 'PRESENT'
                                                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500 ring-offset-1'
                                                        : 'border border-border/80 bg-background text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-600',
                                                )}
                                            >
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                {t('present')}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleStatusChange(student.studentId, 'ABSENT')}
                                                className={cn(
                                                    'flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                                                    student.status === 'ABSENT'
                                                        ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500 ring-offset-1'
                                                        : 'border border-border/80 bg-background text-muted-foreground hover:border-rose-500/40 hover:text-rose-600',
                                                )}
                                            >
                                                <UserX className="h-3.5 w-3.5" />
                                                {t('absent')}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleStatusChange(student.studentId, 'LATE')}
                                                className={cn(
                                                    'flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                                                    student.status === 'LATE'
                                                        ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-500 ring-offset-1'
                                                        : 'border border-border/80 bg-background text-muted-foreground hover:border-amber-500/40 hover:text-amber-600',
                                                )}
                                            >
                                                <Clock className="h-3.5 w-3.5" />
                                                {t('late')}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleStatusChange(student.studentId, 'EXCUSED')}
                                                className={cn(
                                                    'flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                                                    student.status === 'EXCUSED'
                                                        ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-500 ring-offset-1'
                                                        : 'border border-border/80 bg-background text-muted-foreground hover:border-sky-500/40 hover:text-sky-600',
                                                )}
                                            >
                                                <Calendar className="h-3.5 w-3.5" />
                                                {t('excused')}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
