'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Building2,
    Clock,
    Languages,
    MapPin,
    Save,
    Settings,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { authManager } from '@/lib/auth-store';
import {
    fetchPolicy,
    fetchTenant,
    RequestOpts,
    updatePolicy,
} from '@/lib/api/school';
import type { SchoolPolicy, Tenant } from '@edu-lanka/shared-types';
import { HelpButton } from '@/components/HelpButton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox, Field, Input, Select, Switch } from '@/components/ui/Form';
import { PageHeader } from '@/components/ui/Layout';
import { PageSkeleton } from '@/components/ui/Skeleton';

/** Medium-of-instruction options, mirroring the `supported_mediums` enum. */
const MEDIUMS = [
    { value: 'ENGLISH', key: 'medEn' },
    { value: 'SINHALA', key: 'medSi' },
    { value: 'TAMIL', key: 'medTa' },
] as const;

export default function SchoolPolicyPage() {
    const t = useTranslations('InstitutionAdminPolicy');
    const [, setPolicy] = useState<SchoolPolicy | null>(null);
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState<Partial<SchoolPolicy>>({});

    useEffect(() => {
        const load = async () => {
            const opts: RequestOpts = {
                token: authManager.getToken() || '',
                tenantId: authManager.getTenantId() || '',
            };
            try {
                const [policyData, tenantData] = await Promise.all([
                    fetchPolicy(opts),
                    fetchTenant(authManager.getTenantId() || '', opts),
                ]);
                setTenant(tenantData);
                setFormData(policyData || {});
            } catch (err: any) {
                setError(err.message || t('fetchError'));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(null);

        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        try {
            // Strip read-only fields and remap strictly to camelCase for the DTO ValidationPipe
            const {
                academic_year,
                max_students_per_class,
                allow_self_enrollment,
                sms_enabled,
                default_language,
                supported_mediums,
                school_hours_start,
                school_hours_end,
                timezone,
            } = formData as any;

            const dtoPayload = {
                academicYear: academic_year ? Number(academic_year) : undefined,
                maxStudentsPerClass: max_students_per_class
                    ? Number(max_students_per_class)
                    : undefined,
                allowSelfEnrollment: allow_self_enrollment,
                smsEnabled: sms_enabled,
                defaultLanguage: default_language,
                supportedMediums: supported_mediums,
                schoolHoursStart: school_hours_start,
                schoolHoursEnd: school_hours_end,
                timezone: timezone,
            };

            // Purge undefined values
            const cleanPayload = Object.fromEntries(
                Object.entries(dtoPayload).filter(([_, v]) => v !== undefined),
            );

            const updated = await updatePolicy(cleanPayload, opts);
            setPolicy(updated);
            setSuccess(t('successMsg'));
            setTimeout(() => setSuccess(null), 4000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleMedium = (value: string, checked: boolean) => {
        const current = (formData.supported_mediums ?? []) as string[];
        const next = checked
            ? [...current, value]
            : current.filter((m) => m !== value);
        setFormData({ ...formData, supported_mediums: next as any });
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-4xl">
                <PageSkeleton rows={5} cols={2} />
            </div>
        );
    }

    const smsApproved = !!tenant?.smsApproved;

    return (
        <TutorialProvider role="SCHOOL_ADMIN" screenId="policy">
            <div className="mx-auto max-w-4xl">
                <PageHeader
                    icon={<Settings />}
                    title={t('title')}
                    description={t('description')}
                />

                {error && (
                    <Alert tone="danger" className="mb-6" onDismiss={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert tone="success" className="mb-6">
                        {success}
                    </Alert>
                )}

                <motion.form
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleSubmit}
                    className="space-y-6"
                >
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* ── Academic ──────────────────────────────────────── */}
                        <Card>
                            <CardHeader>
                                <CardTitle as="h2" className="flex items-center gap-2">
                                    <Building2 className="size-4 text-primary" />
                                    {t('academicPreferences')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <Field
                                    label={t('currentAcademicYear')}
                                    htmlFor="academic-year"
                                >
                                    <Input
                                        id="academic-year"
                                        type="number"
                                        min={2000}
                                        max={2100}
                                        placeholder="2026"
                                        value={formData.academic_year || ''}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                academic_year: parseInt(
                                                    e.target.value,
                                                    10,
                                                ),
                                            })
                                        }
                                    />
                                </Field>

                                <Field label={t('maxStudents')} htmlFor="max-students">
                                    <Input
                                        id="max-students"
                                        type="number"
                                        min={1}
                                        value={formData.max_students_per_class || ''}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                max_students_per_class: parseInt(
                                                    e.target.value,
                                                    10,
                                                ),
                                            })
                                        }
                                    />
                                </Field>
                            </CardContent>
                        </Card>

                        {/* ── Operations ────────────────────────────────────── */}
                        <Card>
                            <CardHeader>
                                <CardTitle as="h2" className="flex items-center gap-2">
                                    <Clock className="size-4 text-success" />
                                    {t('operationalDetails')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label={t('startTime')} htmlFor="hours-start">
                                        <Input
                                            id="hours-start"
                                            type="time"
                                            step="1"
                                            value={formData.school_hours_start || ''}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    school_hours_start: e.target.value,
                                                })
                                            }
                                        />
                                    </Field>
                                    <Field label={t('endTime')} htmlFor="hours-end">
                                        <Input
                                            id="hours-end"
                                            type="time"
                                            step="1"
                                            value={formData.school_hours_end || ''}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    school_hours_end: e.target.value,
                                                })
                                            }
                                        />
                                    </Field>
                                </div>

                                <Field label={t('timezone')} htmlFor="timezone">
                                    <Input
                                        id="timezone"
                                        type="text"
                                        placeholder="Asia/Colombo"
                                        leadingIcon={<MapPin />}
                                        value={formData.timezone || ''}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                timezone: e.target.value,
                                            })
                                        }
                                    />
                                </Field>
                            </CardContent>
                        </Card>

                        {/* ── Localization ──────────────────────────────────── */}
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle as="h2" className="flex items-center gap-2">
                                    <Languages className="size-4 text-info" />
                                    {t('languageMediums')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-6 md:grid-cols-2">
                                <Field
                                    label={t('defaultLanguage')}
                                    htmlFor="default-language"
                                >
                                    <Select
                                        id="default-language"
                                        value={formData.default_language || 'en'}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                default_language: e.target.value as
                                                    | 'en'
                                                    | 'si'
                                                    | 'ta',
                                            })
                                        }
                                    >
                                        <option value="en">{t('langEn')}</option>
                                        <option value="si">{t('langSi')}</option>
                                        <option value="ta">{t('langTa')}</option>
                                    </Select>
                                </Field>

                                <Field
                                    label={t('supportedMediums')}
                                    hint={t('mediumsHint')}
                                >
                                    <div className="space-y-2 pt-1">
                                        {MEDIUMS.map((medium) => (
                                            <Checkbox
                                                key={medium.value}
                                                label={t(medium.key)}
                                                checked={(
                                                    (formData.supported_mediums ??
                                                        []) as string[]
                                                ).includes(medium.value)}
                                                onChange={(e) =>
                                                    toggleMedium(
                                                        medium.value,
                                                        e.target.checked,
                                                    )
                                                }
                                            />
                                        ))}
                                    </div>
                                </Field>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Toggles ───────────────────────────────────────────── */}
                    <Card>
                        <CardContent className="grid gap-6 pt-5 md:grid-cols-2">
                            <Switch
                                checked={formData.allow_self_enrollment || false}
                                onCheckedChange={(checked) =>
                                    setFormData({
                                        ...formData,
                                        allow_self_enrollment: checked,
                                    })
                                }
                                label={t('selfEnrollment')}
                                hint={t('selfEnrollmentDesc')}
                            />

                            <div>
                                <Switch
                                    checked={smsApproved ? formData.sms_enabled || false : false}
                                    onCheckedChange={(checked) => {
                                        if (smsApproved) {
                                            setFormData({
                                                ...formData,
                                                sms_enabled: checked,
                                            });
                                        }
                                    }}
                                    disabled={!smsApproved}
                                    label={t('smsNotifications')}
                                    hint={
                                        smsApproved
                                            ? t('smsNotificationsDesc')
                                            : t('smsBlocked')
                                    }
                                />
                                {!smsApproved && (
                                    <Badge tone="danger" variant="soft" className="mt-2">
                                        {t('systemLocked')}
                                    </Badge>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            size="lg"
                            loading={saving}
                            leadingIcon={<Save />}
                        >
                            {saving ? t('saving') : t('saveConfig')}
                        </Button>
                    </div>
                </motion.form>

                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
