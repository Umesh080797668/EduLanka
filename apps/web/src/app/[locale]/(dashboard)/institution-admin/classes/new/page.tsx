'use client';

import { useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link, useRouter } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import { createClass, fetchGrades, RequestOpts } from '@/lib/api/school';
import type { GradeProfile } from '@edu-lanka/shared-types';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClass } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Form';
import { PageHeader } from '@/components/ui/Layout';

export default function NewClassPage() {
    const t = useTranslations('InstitutionAdminClasses');
    const router = useRouter();
    const [grades, setGrades] = useState<GradeProfile[]>([]);
    const [gradeId, setGradeId] = useState('');
    const [section, setSection] = useState('');
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [medium, setMedium] = useState('');
    const [saving, setSaving] = useState(false);
    const [loadingGrades, setLoadingGrades] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        fetchGrades(opts)
            .then((res) => {
                setGrades(res);
                if (res.length > 0) setGradeId(res[0].id);
            })
            .finally(() => setLoadingGrades(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        try {
            await createClass(
                {
                    gradeId,
                    section,
                    year: parseInt(year, 10),
                    medium: medium === '' ? undefined : (medium as any),
                },
                opts,
            );
            router.push('/institution-admin/classes');
        } catch (err: any) {
            setError(err.message);
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl">
            <PageHeader
                icon={<BookOpen />}
                breadcrumb={
                    <Link
                        href="/institution-admin/classes"
                        className="inline-flex items-center gap-1.5 rounded-input font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        <ChevronLeft className="size-3.5" />
                        {t('backClasses')}
                    </Link>
                }
                title={t('createNew')}
            />

            {error && (
                <Alert tone="danger" className="mb-6" onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardContent className="space-y-5 pt-6">
                        <Field
                            label={t('curriculumGrade')}
                            htmlFor="grade-id"
                            required
                        >
                            <Select
                                id="grade-id"
                                required
                                disabled={loadingGrades}
                                value={gradeId}
                                onChange={(e) => setGradeId(e.target.value)}
                            >
                                {loadingGrades && (
                                    <option>{t('loadingGrades')}</option>
                                )}
                                {grades.map((g: any) => (
                                    <option key={g.id} value={g.id}>
                                        {g.label || `${t('gradeShort')} ${g.level}`}
                                    </option>
                                ))}
                            </Select>
                        </Field>

                        <Field
                            label={t('section')}
                            hint={t('sectionHint')}
                            htmlFor="section"
                            required
                        >
                            <Input
                                id="section"
                                type="text"
                                required
                                value={section}
                                onChange={(e) => setSection(e.target.value)}
                                placeholder={t('sectionHint')}
                            />
                        </Field>

                        <Field label={t('instructionMedium')} htmlFor="medium">
                            <Select
                                id="medium"
                                value={medium}
                                onChange={(e) => setMedium(e.target.value)}
                            >
                                <option value="">{t('notApplicable')}</option>
                                <option value="ENGLISH">{t('englishMed')}</option>
                                <option value="SINHALA">{t('sinhalaMed')}</option>
                                <option value="TAMIL">{t('tamilMed')}</option>
                            </Select>
                        </Field>

                        <Field label={t('academicYear')} htmlFor="year" required>
                            <Input
                                id="year"
                                type="number"
                                required
                                min={2000}
                                max={2100}
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                            />
                        </Field>

                        <div className="flex justify-end gap-3 pt-2">
                            <Link
                                href="/institution-admin/classes"
                                className={buttonClass({ variant: 'outline' })}
                            >
                                {t('cancel')}
                            </Link>
                            <Button
                                type="submit"
                                loading={saving}
                                leadingIcon={<Plus />}
                            >
                                {saving ? t('creating') : t('createForm')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
