'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ListChecks, Mail, Phone, Save, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { subjectLabel } from '@/lib/subject-areas';
import type { SubjectArea } from '@edu-lanka/shared-types';
import { Alert, Note } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { CredentialHandoff } from '@/components/ui/CredentialHandoff';
import { Field, Input } from '@/components/ui/Form';
import ImageUpload from '@/components/ui/ImageUpload';
import { PageHeader, SectionHeading } from '@/components/ui/Layout';
import { SubjectAreaDialog } from '@/components/teachers/SubjectAreaDialog';

export default function NewTeacherPage() {
    const t = useTranslations('InstitutionAdminTeachers');
    const tc = useTranslations('Common');
    const tf = useTranslations('Forms');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [subjectAreas, setSubjectAreas] = useState<SubjectArea[]>([]);
    const [subjectsOpen, setSubjectsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successData, setSuccessData] = useState<{
        email: string;
        tempPassword: string;
    } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Generate a secure temporary password
            const tempPassword =
                Math.random().toString(36).slice(-8) +
                Math.random().toString(36).slice(-4).toUpperCase() +
                '!';

            const payload: Record<string, unknown> = {
                email,
                fullName,
                temporaryPassword: tempPassword,
            };
            if (phoneNumber) payload['phoneNumber'] = phoneNumber;
            if (avatarUrl) payload['avatarUrl'] = avatarUrl;
            if (subjectAreas.length > 0) payload['subjectAreas'] = subjectAreas;

            await apiClient.post<any>('/teachers', payload, {
                skipGlobalToast: true,
            });

            toast.success(t('accountProvisioned'), {
                description: t('profileCreated'),
            });
            setSuccessData({ email, tempPassword });
        } catch (err: any) {
            const msg = err.message || tc('somethingWentWrong');
            setError(msg);
            toast.error(tf('provisioningFailed'), { description: msg });
        } finally {
            setLoading(false);
        }
    };

    if (successData) {
        return (
            <CredentialHandoff
                email={successData.email}
                tempPassword={successData.tempPassword}
                labels={{
                    title: t('accountProvisioned'),
                    subtitle: t('profileCreated'),
                    intro: t('provideTemp'),
                    emailLabel: t('loginEmail'),
                    passwordLabel: t('tempPassword'),
                    copyLabel: t('copyPassword'),
                    addAnother: t('addAnother'),
                    returnLabel: t('returnDirectory'),
                }}
                onAddAnother={() => {
                    setFullName('');
                    setEmail('');
                    setPhoneNumber('');
                    setAvatarUrl('');
                    setSubjectAreas([]);
                    setSuccessData(null);
                }}
                returnAction={
                    <Link
                        href="/institution-admin/teachers"
                        className={buttonClass({ variant: 'primary' })}
                    >
                        {t('returnDirectory')}
                    </Link>
                }
            />
        );
    }

    return (
        <div className="mx-auto max-w-3xl">
            <PageHeader
                icon={<UserPlus />}
                breadcrumb={
                    <Link
                        href="/institution-admin/teachers"
                        className="inline-flex items-center gap-1.5 rounded-input font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        <ChevronLeft className="size-3.5" />
                        {t('backTeachers')}
                    </Link>
                }
                title={t('addNewTeacher')}
                description={t('createNewProfile')}
            />

            {error && (
                <Alert tone="danger" className="mb-6" onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <form id="teacherForm" onSubmit={handleSubmit}>
                    <Card flush>
                        <CardContent className="space-y-8 p-6 sm:p-8">
                            {/* ── Personal ──────────────────────────────────── */}
                            <div>
                                <SectionHeading
                                    title={t('personalInfo')}
                                    className="mb-5"
                                />

                                <div className="mb-6 flex items-center gap-4">
                                    <ImageUpload
                                        currentImageUrl={avatarUrl}
                                        onUploadSuccess={setAvatarUrl}
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

                                <Field
                                    label={t('fullName')}
                                    htmlFor="teacher-name"
                                    required
                                >
                                    <Input
                                        id="teacher-name"
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder={tf('phFullName')}
                                    />
                                </Field>
                            </div>

                            {/* ── Contact ───────────────────────────────────── */}
                            <div>
                                <SectionHeading
                                    title={t('contactDetails')}
                                    className="mb-5"
                                />
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <Field
                                        label={t('emailAddress')}
                                        htmlFor="teacher-email"
                                        required
                                    >
                                        <Input
                                            id="teacher-email"
                                            type="email"
                                            required
                                            leadingIcon={<Mail />}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={tf('phEmail')}
                                        />
                                    </Field>

                                    <Field
                                        label={`${t('mobileNumber')} (${tc('optional')})`}
                                        htmlFor="teacher-phone"
                                    >
                                        <Input
                                            id="teacher-phone"
                                            type="tel"
                                            leadingIcon={<Phone />}
                                            value={phoneNumber}
                                            onChange={(e) =>
                                                setPhoneNumber(e.target.value)
                                            }
                                            placeholder={tf('phMobile')}
                                        />
                                    </Field>
                                </div>
                            </div>

                            {/* ── Teaching load ─────────────────────────────── */}
                            <div>
                                <SectionHeading
                                    title={t('subjectAreas')}
                                    description={t('manageSubjectsDesc')}
                                    className="mb-5"
                                />

                                {subjectAreas.length > 0 && (
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        {subjectAreas.map((subject) => (
                                            <Badge key={subject} tone="primary">
                                                {subjectLabel(subject)}
                                            </Badge>
                                        ))}
                                    </div>
                                )}

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSubjectsOpen(true)}
                                    leadingIcon={<ListChecks />}
                                >
                                    {subjectAreas.length > 0
                                        ? t('editSubjects')
                                        : t('addSubjects')}
                                </Button>
                            </div>

                            <Note>{t('securePasswordGen')}</Note>
                        </CardContent>
                        <CardFooter className="justify-end gap-3">
                            <Link
                                href="/institution-admin/teachers"
                                className={buttonClass({ variant: 'outline' })}
                            >
                                {t('cancel')}
                            </Link>
                            <Button
                                type="submit"
                                form="teacherForm"
                                loading={loading}
                                disabled={!fullName || !email}
                                leadingIcon={<Save />}
                            >
                                {t('createAccount')}
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </motion.div>

            <SubjectAreaDialog
                open={subjectsOpen}
                onClose={() => setSubjectsOpen(false)}
                value={subjectAreas}
                onChange={setSubjectAreas}
            />
        </div>
    );
}
