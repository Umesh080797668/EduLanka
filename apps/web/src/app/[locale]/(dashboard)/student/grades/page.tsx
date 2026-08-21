'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, FileText, Inbox, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { authManager } from '@/lib/auth-store';
import { gradeFor } from '@/lib/grades';
import { HelpButton } from '@/components/HelpButton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Form';
import { EmptyState, PageHeader, SectionHeading } from '@/components/ui/Layout';
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

export default function StudentGradesPage() {
    const t = useTranslations('StudentGrades');
    const searchParams = useSearchParams();
    const query = searchParams.get('query')?.toLowerCase() || '';

    const [studentId, setStudentId] = useState<string | null>(null);
    const [marks, setMarks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchingMarks, setFetchingMarks] = useState(false);
    const [term, setTerm] = useState(1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [downloading, setDownloading] = useState(false);

    // Resolve the signed-in user's student profile to get its ID.
    useEffect(() => {
        const init = async () => {
            try {
                const data = await apiClient.get<any>('/students/me');
                if (data) {
                    setStudentId(data.id);
                } else {
                    console.error(t('failedToResolve'));
                }
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        };
        init();
    }, [t]);

    // Reload marks when the term, student, or search query changes.
    useEffect(() => {
        const fetchMarks = async () => {
            if (!studentId) return;
            setFetchingMarks(true);
            try {
                const marksData = await apiClient.get<any>(
                    `/student-marks/student/${studentId}`,
                );
                if (marksData) {
                    setMarks(
                        marksData.filter((m: any) => {
                            const termMatch = String(m.term) === String(term);
                            if (!query) return termMatch;
                            return (
                                termMatch &&
                                (m.subject || '').toLowerCase().includes(query)
                            );
                        }),
                    );
                }
            } catch (e) {
                console.error(t('failedToLoad'), e);
            } finally {
                setFetchingMarks(false);
            }
        };
        fetchMarks();
    }, [studentId, term, query, t]);

    const handleDownload = async () => {
        if (!studentId) return;
        setDownloading(true);
        try {
            const res = await fetch(
                `/api/v1/report-cards/student/${studentId}/term/${term}/year/${year}/download`,
                {
                    credentials: 'include',
                    headers: { 'X-Tenant-Id': authManager.getTenantId() || '' },
                },
            );

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `report-card-term${term}-${year}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                toast.error(t('reportNotFound'));
            }
        } catch (e) {
            console.error(e);
            toast.error(t('failedToDownload'));
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="grid min-h-[60vh] place-items-center">
                <Spinner />
            </div>
        );
    }

    if (!studentId) {
        return (
            <Card className="mx-auto mt-8 max-w-md">
                <EmptyState
                    tone="danger"
                    icon={<ShieldAlert />}
                    title={t('profileNotFound')}
                    description={t('profileNotFoundMsg')}
                />
            </Card>
        );
    }

    return (
        <TutorialProvider role="STUDENT" screenId="grades">
            <div className="mx-auto max-w-5xl">
                <PageHeader
                    icon={<FileText />}
                    title={t('myReportCards')}
                    description={t('myReportCardsMsg')}
                    actions={
                        <Button
                            onClick={handleDownload}
                            loading={downloading}
                            disabled={marks.length === 0}
                            leadingIcon={<Download />}
                        >
                            {downloading ? t('generatingPdf') : t('downloadOfficial')}
                        </Button>
                    }
                />

                <div className="space-y-6">
                    {/* ── Filters ───────────────────────────────────────────── */}
                    <Card>
                        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
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

                    {/* ── Results ───────────────────────────────────────────── */}
                    <section>
                        <SectionHeading
                            title={t('termResults')}
                            actions={
                                marks.length > 0 ? (
                                    <Badge tone="neutral">{marks.length}</Badge>
                                ) : null
                            }
                        />

                        <TableWrap>
                            <Table>
                                <THead>
                                    <TR>
                                        <TH>{t('subject')}</TH>
                                        <TH align="right">{t('score')}</TH>
                                        <TH align="right">{t('grade')}</TH>
                                    </TR>
                                </THead>
                                <TBody>
                                    <AnimatePresence mode="wait" initial={false}>
                                        {fetchingMarks ? (
                                            <TDEmpty colSpan={3}>
                                                <div className="py-10">
                                                    <Spinner size="sm" />
                                                </div>
                                            </TDEmpty>
                                        ) : marks.length === 0 ? (
                                            <TDEmpty colSpan={3}>
                                                <EmptyState
                                                    size="sm"
                                                    icon={<Inbox />}
                                                    title={t('noMarksYet')}
                                                />
                                            </TDEmpty>
                                        ) : (
                                            marks.map((m: any, idx) => {
                                                const grade = gradeFor(Number(m.marks));
                                                return (
                                                    <motion.tr
                                                        key={m.id}
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
                                                        <TD className="font-medium">
                                                            {m.subject}
                                                        </TD>
                                                        <TD align="right" numeric>
                                                            {m.marks}
                                                        </TD>
                                                        <TD align="right">
                                                            <Badge tone={grade.tone}>
                                                                {t(grade.key)}
                                                            </Badge>
                                                        </TD>
                                                    </motion.tr>
                                                );
                                            })
                                        )}
                                    </AnimatePresence>
                                </TBody>
                            </Table>
                        </TableWrap>

                        {marks.length === 0 && (
                            <p className="mt-3 text-xs text-muted-foreground">
                                {t('marksMustBeAvailable')}
                            </p>
                        )}
                    </section>
                </div>

                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
