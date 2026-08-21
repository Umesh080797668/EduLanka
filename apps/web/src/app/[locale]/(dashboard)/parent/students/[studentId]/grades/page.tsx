'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Download, FileText, Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/i18n/routing';
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

export default function ParentGradesPage() {
    const t = useTranslations('ParentGrades');
    const params = useParams();
    const studentId = params?.studentId as string;

    const [term, setTerm] = useState(1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [downloading, setDownloading] = useState(false);
    const [fetchingMarks, setFetchingMarks] = useState(false);
    const [marks, setMarks] = useState<any[]>([]);

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
                        marksData.filter(
                            (m: any) => String(m.term) === String(term),
                        ),
                    );
                }
            } catch (e) {
                console.error(t('failedToLoad'), e);
            } finally {
                setFetchingMarks(false);
            }
        };
        fetchMarks();
    }, [studentId, term, t]);

    const handleDownload = async () => {
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
                a.download = `report-card-${studentId}-term${term}-${year}.pdf`;
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

    return (
        <TutorialProvider role="PARENT" screenId="grades">
            <div className="mx-auto max-w-5xl">
                <PageHeader
                    icon={<FileText />}
                    breadcrumb={
                        <Link
                            href="/parent"
                            className="inline-flex items-center gap-1.5 rounded-input font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            <ArrowLeft className="size-3.5" />
                            {t('backToDashboard')}
                        </Link>
                    }
                    title={t('childReportCard')}
                    description={t('reviewProgress')}
                    actions={
                        <Button
                            onClick={handleDownload}
                            loading={downloading}
                            disabled={marks.length === 0}
                            leadingIcon={<Download />}
                        >
                            {downloading ? t('downloadingPdf') : t('downloadOfficial')}
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
                                                    title={t('noMarksForChild')}
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
                                {t('marksAvailableToGenerate')}
                            </p>
                        )}
                    </section>
                </div>

                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
