'use client';

import { useState } from 'react';
import { CheckCircle2, KeyRound, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClass } from '@/components/ui/Button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Form';

export default function ResetPasswordPage() {
    const t = useTranslations('ResetPassword');
    const [email, setEmail] = useState('');
    const [tenantId, setTenantId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await apiClient.post(
                '/auth/forgot-password',
                { email },
                {
                    headers: { 'x-tenant-id': tenantId },
                    skipGlobalToast: true,
                },
            );

            setSuccess(true);
            toast.success(t('resetLinkSent'), { description: t('resetLinkSentDesc') });
        } catch (err: any) {
            const msg = err.message || t('networkError');
            setError(msg);
            toast.error(t('couldNotReset'), { description: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex-col items-stretch gap-0 pb-2 pt-7 text-center sm:px-8">
                <span className="mx-auto grid size-14 place-items-center rounded-card bg-primary-subtle text-primary">
                    <KeyRound className="size-7" />
                </span>
                <CardTitle as="h1" className="mt-5 text-display-sm">
                    {t('title')}
                </CardTitle>
                <CardDescription>{t('subtitle')}</CardDescription>
            </CardHeader>

            <CardContent className="pt-5 sm:px-8">
                {error && (
                    <Alert tone="danger" className="mb-5">
                        {error}
                    </Alert>
                )}

                {success ? (
                    <div className="animate-fade-in">
                        <Alert
                            tone="success"
                            icon={<CheckCircle2 />}
                            title={t('checkInbox')}
                        >
                            {t('sentLink')} <strong className="font-semibold">{email}</strong>.
                        </Alert>
                        <Link
                            href="/login"
                            className={buttonClass({
                                size: 'lg',
                                block: true,
                                className: 'mt-5',
                            })}
                        >
                            {t('returnSignIn')}
                        </Link>
                    </div>
                ) : (
                    <>
                        <form onSubmit={handleReset} className="space-y-4">
                            <Field label={t('schoolId')} htmlFor="tenantId" required>
                                <Input
                                    id="tenantId"
                                    type="text"
                                    required
                                    value={tenantId}
                                    onChange={(e) => setTenantId(e.target.value)}
                                    placeholder={t('schoolIdPlaceholder')}
                                />
                            </Field>

                            <Field label={t('email')} htmlFor="email" required>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    leadingIcon={<Mail />}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t('emailPlaceholder')}
                                />
                            </Field>

                            <Button
                                type="submit"
                                size="lg"
                                block
                                loading={loading}
                                className="mt-2"
                            >
                                {loading ? t('sending') : t('sendLink')}
                            </Button>
                        </form>

                        <p className="mt-6 text-center text-sm">
                            <Link
                                href="/login"
                                className="font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                            >
                                {t('cancelReturn')}
                            </Link>
                        </p>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
