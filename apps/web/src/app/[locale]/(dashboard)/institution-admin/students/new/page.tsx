'use client';

import { useEffect, useState } from 'react';
import { GraduationCap, ChevronLeft, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link, useRouter } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import { enrollStudent, fetchClasses, RequestOpts } from '@/lib/api/school';
import { ALStream, Gender } from '@edu-lanka/shared-types';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClass } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Form';
import ImageUpload from '@/components/ui/ImageUpload';
import { PageHeader, SectionHeading } from '@/components/ui/Layout';

export default function NewStudentPage() {
    const t = useTranslations('InstitutionAdminStudents');
    const tc = useTranslations('Common');
    const tf = useTranslations('Forms');
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [classes, setClasses] = useState<any[]>([]);

    useEffect(() => {
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        fetchClasses(opts).then(setClasses).catch(() => { });
    }, []);

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        admissionNo: '',
        phoneNumber: '',
        dateOfBirth: '',
        gender: Gender.MALE,
        alStream: '' as ALStream | '',
        classId: '',
        temporaryPassword: 'TempPassword123!',
        avatarUrl: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        try {
            await enrollStudent({
                ...formData,
                alStream: formData.alStream === '' ? undefined : formData.alStream,
                classId: formData.classId === '' ? undefined : formData.classId,
            }, opts);
            router.push('/institution-admin/students');
        } catch (err: any) {
            setError(err.message);
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-3xl">
            <PageHeader
                icon={<GraduationCap />}
                breadcrumb={
                    <Link
                        href="/institution-admin/students"
                        className="inline-flex items-center gap-1.5 rounded-input font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        <ChevronLeft className="size-3.5" />
                        {t('backStudents')}
                    </Link>
                }
                title={t('enrollNewStudent')}
            />

            {error && (
                <Alert tone="danger" className="mb-6" onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* ── Account ───────────────────────────────────────────────── */}
                <Card>
                    <CardContent className="pt-6">
                        <SectionHeading title={t('accountDetails')} className="mb-5" />

                        <div className="mb-6 flex items-center gap-4">
                            <ImageUpload
                                currentImageUrl={formData.avatarUrl}
                                onUploadSuccess={(url) =>
                                    setFormData((prev) => ({ ...prev, avatarUrl: url }))
                                }
                                onError={(err) => toast.error(err)}
                                size={80}
                                className="shrink-0"
                            />
                            <div className="text-sm">
                                <p className="font-semibold text-foreground">
                                    {tf('profilePicture')}
                                </p>
                                <p className="text-muted-foreground">
                                    {tf('profilePictureHint')}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field label={t('fullName')} htmlFor="full-name" required>
                                <Input
                                    id="full-name"
                                    type="text"
                                    required
                                    value={formData.fullName}
                                    onChange={(e) =>
                                        setFormData({ ...formData, fullName: e.target.value })
                                    }
                                    placeholder={tf('phFullName')}
                                />
                            </Field>

                            <Field
                                label={`${t('emailAddress')} (${tc('optional')})`}
                                htmlFor="email"
                            >
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) =>
                                        setFormData({ ...formData, email: e.target.value })
                                    }
                                    placeholder={tf('phEmail')}
                                />
                            </Field>

                            <Field
                                label={t('tempPassword')}
                                htmlFor="temp-password"
                                required
                            >
                                <Input
                                    id="temp-password"
                                    type="text"
                                    required
                                    value={formData.temporaryPassword}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            temporaryPassword: e.target.value,
                                        })
                                    }
                                />
                            </Field>

                            <Field label={t('phoneNumber')} htmlFor="phone">
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phoneNumber}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            phoneNumber: e.target.value,
                                        })
                                    }
                                    placeholder={tf('phMobile')}
                                />
                            </Field>
                        </div>
                    </CardContent>
                </Card>

                {/* ── School profile ────────────────────────────────────────── */}
                <Card>
                    <CardContent className="pt-6">
                        <SectionHeading title={t('schoolProfile')} className="mb-5" />

                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field label={t('classAssignmentOpt')} htmlFor="class-id">
                                <Select
                                    id="class-id"
                                    value={formData.classId}
                                    onChange={(e) =>
                                        setFormData({ ...formData, classId: e.target.value })
                                    }
                                >
                                    <option value="">{t('noneNotSpecified')}</option>
                                    {classes.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.grades?.label ||
                                                `${t('gradeShort')} ${c.grade}`}{' '}
                                            &ndash; {c.section}
                                        </option>
                                    ))}
                                </Select>
                            </Field>

                            <Field
                                label={t('admissionNumber')}
                                hint={t('autoGeneratedIfBlank')}
                                htmlFor="admission-no"
                            >
                                <Input
                                    id="admission-no"
                                    type="text"
                                    value={formData.admissionNo}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            admissionNo: e.target.value,
                                        })
                                    }
                                    placeholder={t('autoGeneratedIfBlank')}
                                />
                            </Field>

                            <Field label={t('dob')} htmlFor="dob">
                                <Input
                                    id="dob"
                                    type="date"
                                    value={formData.dateOfBirth}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            dateOfBirth: e.target.value,
                                        })
                                    }
                                />
                            </Field>

                            <Field label={t('gender')} htmlFor="gender">
                                <Select
                                    id="gender"
                                    value={formData.gender}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            gender: e.target.value as Gender,
                                        })
                                    }
                                >
                                    <option value={Gender.MALE}>{t('male')}</option>
                                    <option value={Gender.FEMALE}>{t('female')}</option>
                                    <option value={Gender.OTHER}>{t('other')}</option>
                                </Select>
                            </Field>

                            <Field label={t('alStream')} htmlFor="al-stream">
                                <Select
                                    id="al-stream"
                                    value={formData.alStream}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            alStream: e.target.value as ALStream | '',
                                        })
                                    }
                                >
                                    <option value="">{t('noneDash')}</option>
                                    <option value={ALStream.MATHS}>{t('maths')}</option>
                                    <option value={ALStream.SCIENCE}>{t('science')}</option>
                                    <option value={ALStream.COMMERCE}>
                                        {t('commerce')}
                                    </option>
                                    <option value={ALStream.ARTS}>{t('arts')}</option>
                                    <option value={ALStream.TECHNOLOGY}>
                                        {t('technology')}
                                    </option>
                                </Select>
                            </Field>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                    <Link
                        href="/institution-admin/students"
                        className={buttonClass({ variant: 'outline' })}
                    >
                        {t('cancel')}
                    </Link>
                    <Button type="submit" loading={saving} leadingIcon={<UserPlus />}>
                        {saving ? t('enrolling') : t('enrollStudentBtn')}
                    </Button>
                </div>
            </form>
        </div>
    );
}
