'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
    CheckCircle2,
    ChevronLeft,
    FileEdit,
    Save,
    Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { HelpButton } from '@/components/HelpButton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Form';
import { PageHeader } from '@/components/ui/Layout';
import { Spinner } from '@/components/ui/Spinner';
import {
    Table,
    TableWrap,
    TBody,
    TD,
    TDEmpty,
    TH,
    THead,
    TR,
} from '@/components/ui/Table';

interface MarkState {
    value: number | '';
    saving: boolean;
    saved: boolean;
}

export default function TeacherGradesPage() {
    const t = useTranslations('TeacherGradesEntry');
    const params = useParams();
    const classId = params.classId as string;

    const [students, setStudents] = useState<any[]>([]);
    const [className, setClassName] = useState('');
    const [marks, setMarks] = useState<Record<string, MarkState>>({});
    const [subject, setSubject] = useState('MATHEMATICS');
    const [term, setTerm] = useState(1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [pageLoading, setPageLoading] = useState(true);

    useEffect(() => {
        const loadClassDetails = async () => {
            try {
                const classData = await apiClient.get<any>(`/classes/${classId}`);
                if (classData?.grades?.level || classData?.section) {
                    setClassName(
                        `${classData.grades?.level ?? ''} ${classData.section ?? ''}`.trim(),
                    );
                }
                if (classData && classData.students) {
                    setStudents(
                        classData.students.map((st: any) => ({
                            id: st.id,
                            admissionNo: st.admission_no,
                            name: st.users?.full_name || 'Unknown',
                        })),
                    );
                }
            } catch (e) {
                console.error(t('failedToFetchRoster'), e);
            }
        };

        const fetchMarks = async () => {
            try {
                const marksData = await apiClient.get<any>(
                    `/student-marks/class/${classId}?term=${term}&year=${year}`,
                );
                const newMarks: Record<string, MarkState> = {};
                marksData?.forEach((m: any) => {
                    const val =
                        m.total_score !== null && m.total_score !== undefined
                            ? m.total_score
                            : typeof m.marks === 'number'
                                ? m.marks
                                : '';
                    newMarks[m.student_id] = { value: val, saving: false, saved: true };
                });
                setMarks(newMarks);
            } catch (e) {
                console.error(t('failedToFetchMarks'), e);
            }
        };

        const loadAll = async () => {
            setPageLoading(true);
            await loadClassDetails();
            await fetchMarks();
            setPageLoading(false);
        };

        loadAll();
    }, [classId, subject, term, year, t]);

    const handleSave = async (studentId: string) => {
        const currentMark = marks[studentId]?.value;
        if (currentMark === undefined || currentMark === '') return;

        setMarks((prev) => ({
            ...prev,
            [studentId]: { ...prev[studentId], saving: true, saved: false },
        }));

        try {
            await apiClient.post<any>(
                '/student-marks',
                {
                    studentId,
                    classId,
                    subject,
                    term,
                    academicYear: year,
                    marks: currentMark,
                },
                { skipGlobalToast: true },
            );

            setMarks((prev) => ({
                ...prev,
                [studentId]: { ...prev[studentId], saving: false, saved: true },
            }));
            setTimeout(() => {
                setMarks((prev) => {
                    if (!prev[studentId]) return prev;
                    return {
                        ...prev,
                        [studentId]: { ...prev[studentId], saved: false },
                    };
                });
            }, 2000);
        } catch (e: any) {
            console.error(e);
            setMarks((prev) => ({
                ...prev,
                [studentId]: { ...prev[studentId], saving: false, saved: false },
            }));
            toast.error(t('errorSaving'), {
                description: e.message || undefined,
            });
        }
    };

    const handleMarkChange = (studentId: string, value: string) => {
        const parsed: number | '' = value === '' ? '' : Number(value);
        if (typeof parsed === 'number' && (parsed < 0 || parsed > 100)) return;
        setMarks((prev) => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                value: parsed,
                saving: false,
                saved: false,
            },
        }));
    };

    return (
        <TutorialProvider role="TEACHER" screenId="grades">
            <div className="mx-auto max-w-5xl">
                <PageHeader
                    icon={<FileEdit />}
                    breadcrumb={
                        <Link
                            href="/teacher/classes"
                            className="inline-flex items-center gap-1.5 rounded-input font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            <ChevronLeft className="size-3.5" />
                            {t('backToClasses')}
                        </Link>
                    }
                    title={t('gradeEntry')}
                    description={className || `${t('classId')} ${classId}`}
                    badge={
                        students.length > 0 ? (
                            <Badge tone="primary" dot>
                                {t('rosterCount')}: {students.length}
                            </Badge>
                        ) : undefined
                    }
                />

                <div className="space-y-6">
                    {/* ── Entry context ─────────────────────────────────────── */}
                    <Card>
                        <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
                            <Field label={t('subject')} htmlFor="subject">
                                <Select
                                    id="subject"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                >
                                    <option value="MATHEMATICS">{t('math')}</option>
                                    <option value="SCIENCE">{t('science')}</option>
                                    <option value="ENGLISH">{t('english')}</option>
                                    <option value="SINHALA">{t('sinhala')}</option>
                                </Select>
                            </Field>

                            <Field label={t('academicTerm')} htmlFor="term">
                                <Select
                                    id="term"
                                    value={term}
                                    onChange={(e) => setTerm(Number(e.target.value))}
                                >
                                    <option value={1}>{t('term1')}</option>
                                    <option value={2}>{t('term2')}</option>
                                    <option value={3}>{t('term3')}</option>
                                </Select>
                            </Field>

                            <Field label={t('academicYear')} htmlFor="year">
                                <Input
                                    id="year"
                                    type="number"
                                    min={2000}
                                    max={2100}
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                />
                            </Field>
                        </CardContent>
                    </Card>

                    {/* ── Roster ────────────────────────────────────────────── */}
                    <div className="relative">
                        <AnimatePresence>
                            {pageLoading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-card bg-background/70 backdrop-blur-sm"
                                >
                                    <Spinner />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <TableWrap>
                            <Table>
                                <THead>
                                    <TR>
                                        <TH className="w-32">{t('indexNo')}</TH>
                                        <TH>{t('studentName')}</TH>
                                        <TH align="center" className="w-40">
                                            {t('marksOutof100')}
                                        </TH>
                                        <TH align="center" className="w-36">
                                            {t('action')}
                                        </TH>
                                    </TR>
                                </THead>
                                <TBody>
                                    {!pageLoading && students.length === 0 ? (
                                        <TDEmpty colSpan={4}>
                                            <div className="flex flex-col items-center gap-3 py-8">
                                                <Users className="size-8 text-border-strong" />
                                                <p>{t('noStudentsFound')}</p>
                                            </div>
                                        </TDEmpty>
                                    ) : (
                                        students.map((s, idx) => {
                                            const state =
                                                marks[s.id] ?? {
                                                    value: '',
                                                    saving: false,
                                                    saved: false,
                                                };
                                            const dirty =
                                                state.value !== '' &&
                                                !state.saved &&
                                                !state.saving;

                                            return (
                                                <motion.tr
                                                    key={s.id}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{
                                                        opacity: 1,
                                                        y: 0,
                                                        transition: {
                                                            delay: Math.min(idx * 0.04, 0.4),
                                                        },
                                                    }}
                                                    className="transition-colors hover:bg-accent/60"
                                                >
                                                    <TD className="numeric text-muted-foreground">
                                                        {s.admissionNo}
                                                    </TD>
                                                    <TD className="font-medium">{s.name}</TD>
                                                    <TD align="center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Input
                                                                inputSize="sm"
                                                                type="number"
                                                                min={0}
                                                                max={100}
                                                                value={state.value}
                                                                placeholder="–"
                                                                aria-label={`${t('marksOutof100')} — ${s.name}`}
                                                                onChange={(e) =>
                                                                    handleMarkChange(
                                                                        s.id,
                                                                        e.target.value,
                                                                    )
                                                                }
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handleSave(s.id);
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    'w-20 text-center font-semibold',
                                                                    dirty &&
                                                                    'ring-2 ring-warning/40',
                                                                )}
                                                            />
                                                        </div>
                                                    </TD>
                                                    <TD align="center">
                                                        {state.saved ? (
                                                            <Badge
                                                                tone="success"
                                                                size="md"
                                                                className="min-w-[86px] justify-center"
                                                            >
                                                                <CheckCircle2 className="size-3.5" />
                                                                {t('saved')}
                                                            </Badge>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                variant={
                                                                    dirty ? 'primary' : 'outline'
                                                                }
                                                                className="min-w-[86px]"
                                                                loading={state.saving}
                                                                disabled={state.value === ''}
                                                                leadingIcon={<Save />}
                                                                onClick={() => handleSave(s.id)}
                                                            >
                                                                {t('save')}
                                                            </Button>
                                                        )}
                                                    </TD>
                                                </motion.tr>
                                            );
                                        })
                                    )}
                                </TBody>
                            </Table>
                        </TableWrap>
                    </div>
                </div>

                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
