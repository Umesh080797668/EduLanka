'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
    Users,
    ArrowLeft,
    Search,
    FileEdit,
    Mail,
    Phone,
    GraduationCap,
    School,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Form';
import { PageHeader, EmptyState } from '@/components/ui/Layout';
import { StatCard } from '@/components/ui/Stat';

interface StudentRecord {
    id: string;
    admission_no: string;
    gender?: string;
    users?: {
        full_name?: string;
        email?: string;
        phone_number?: string;
    };
}

interface ClassDetails {
    id: string;
    name: string;
    grade: number;
    section: string;
    academic_year: string;
    students?: StudentRecord[];
    class_teachers?: Array<{
        is_homeroom?: boolean;
        teachers?: {
            users?: {
                full_name?: string;
            };
        };
    }>;
}

export default function TeacherClassRosterPage() {
    const t = useTranslations('TeacherRoster');
    const params = useParams();
    const classId = params?.classId as string;

    const [classData, setClassData] = useState<ClassDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!classId) return;
        const fetchClass = async () => {
            try {
                const data = await apiClient.get<ClassDetails>(`/classes/${classId}`, {
                    skipGlobalToast: true,
                });
                if (data) {
                    setClassData(data);
                }
            } catch {
                toast.error(t('loadFailed'));
            } finally {
                setLoading(false);
            }
        };

        void fetchClass();
    }, [classId, t]);

    const homeroomTeacher = classData?.class_teachers?.find((ct) => ct.is_homeroom)?.teachers?.users?.full_name;

    const filteredStudents = useMemo(() => {
        const list = classData?.students || [];
        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(
            (s) =>
                s.admission_no?.toLowerCase().includes(q) ||
                s.users?.full_name?.toLowerCase().includes(q) ||
                s.users?.email?.toLowerCase().includes(q),
        );
    }, [classData?.students, searchQuery]);

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="h-20 animate-pulse rounded-card bg-muted/40" />
                <div className="h-64 animate-pulse rounded-card bg-muted/40" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Link
                        href="/teacher/classes"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground mb-2"
                    >
                        <ArrowLeft className="size-3.5" />
                        {t('backToClasses')}
                    </Link>
                    <PageHeader
                        icon={<Users />}
                        title={`${classData?.name || 'Class'} Roster`}
                        description={`Grade ${classData?.grade} • Section ${classData?.section} • Academic Year ${classData?.academic_year || 'Current'}`}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href={`/teacher/classes/${classId}/grades`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-input bg-brand-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
                    >
                        <FileEdit className="size-3.5" />
                        {t('enterGrades')}
                    </Link>
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid gap-4 sm:grid-cols-2">
                <StatCard
                    label={t('totalStudents')}
                    value={classData?.students?.length || 0}
                    icon={<GraduationCap />}
                    tone="primary"
                    hint={`Active in Grade ${classData?.grade || ''}`}
                />
                <StatCard
                    label="Homeroom Teacher"
                    value={homeroomTeacher || 'Unassigned'}
                    icon={<School />}
                    tone="info"
                    hint="Classroom Lead"
                />
            </div>

            {/* Students Table */}
            <Card>
                <CardHeader className="flex-row items-center justify-between gap-4 pb-3">
                    <CardTitle as="h2" className="text-base flex items-center gap-2">
                        <Users className="size-4 text-brand-600 dark:text-brand-400" />
                        Enrolled Students ({filteredStudents.length})
                    </CardTitle>

                    <div className="relative w-64 max-w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                            placeholder={t('searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 text-xs h-8"
                        />
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {filteredStudents.length === 0 ? (
                        <div className="p-6">
                            <EmptyState
                                icon={<Users className="size-8" />}
                                title={t('noStudents')}
                                description="No student records match your query."
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                                    <tr>
                                        <th className="p-3.5">{t('colAdmission')}</th>
                                        <th className="p-3.5">{t('colStudent')}</th>
                                        <th className="p-3.5">{t('colGender')}</th>
                                        <th className="p-3.5">{t('colGuardians')}</th>
                                        <th className="p-3.5 text-right">{t('colStatus')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredStudents.map((student) => (
                                        <tr key={student.id} className="transition-colors hover:bg-muted/20">
                                            <td className="p-3.5 font-mono font-medium text-foreground">
                                                {student.admission_no}
                                            </td>
                                            <td className="p-3.5">
                                                <div className="font-semibold text-foreground">
                                                    {student.users?.full_name || '—'}
                                                </div>
                                                {student.users?.email && (
                                                    <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                                                        <Mail className="size-3" />
                                                        <span>{student.users.email}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3.5">
                                                <Badge size="sm" variant="soft" tone={student.gender === 'FEMALE' ? 'warning' : 'info'}>
                                                    {student.gender || '—'}
                                                </Badge>
                                            </td>
                                            <td className="p-3.5">
                                                {student.users?.phone_number ? (
                                                    <div className="flex items-center gap-1 text-foreground font-mono">
                                                        <Phone className="size-3 text-muted-foreground" />
                                                        <span>{student.users.phone_number}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-right">
                                                <Badge tone="success" size="sm">
                                                    Enrolled
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
