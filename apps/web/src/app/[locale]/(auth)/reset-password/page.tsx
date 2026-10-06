'use client';
import { useState, useSyncExternalStore } from 'react';
import { CheckCircle2, KeyRound, Lock, Mail } from 'lucide-react';
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

function getResetTokenSnapshot(): string | null {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash.startsWith('#')
        ? window.location.hash.substring(1)
        : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    let extractedToken = hashParams.get('access_token');
    if (!extractedToken) {
        const searchParams = new URLSearchParams(window.location.search);
        extractedToken = searchParams.get('access_token') || searchParams.get('token');
    }
    return extractedToken || null;
}

function subscribeToUrl(callback: () => void) {
    window.addEventListener('hashchange', callback);
    window.addEventListener('popstate', callback);
    return () => {
        window.removeEventListener('hashchange', callback);
        window.removeEventListener('popstate', callback);
    };
}

export default function ResetPasswordPage() {
    const t = useTranslations('ResetPassword');

    // Token extracted synchronously without triggering cascading renders
    const token = useSyncExternalStore(subscribeToUrl, getResetTokenSnapshot, () => null);

    // Request form state
    const [email, setEmail] = useState('');
    const [requestLoading, setRequestLoading] = useState(false);
    const [requestSuccess, setRequestSuccess] = useState(false);

    // Update form state
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateSuccess, setUpdateSuccess] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setRequestLoading(true);
        setError(null);

        try {
            await apiClient.post(
                '/auth/forgot-password',
                { email },
                { skipGlobalToast: true },
            );

            setRequestSuccess(true);
            toast.success(t('resetLinkSent'), { description: t('resetLinkSentDesc') });
        } catch (err: any) {
            const msg = err.message || t('networkError');
            setError(msg);
            toast.error(t('couldNotReset'), { description: msg });
        } finally {
            setRequestLoading(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword.length < 8) {
            setError(t('passwordTooShort'));
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(t('passwordsDoNotMatch'));
            return;
        }

        if (!token) {
            setError(t('couldNotReset'));
            return;
        }

        setUpdateLoading(true);

        try {
            await apiClient.post(
                '/auth/reset-password',
                {
                    accessToken: token,
                    newPassword,
                },
                { skipGlobalToast: true },
            );

            setUpdateSuccess(true);
            toast.success(t('passwordUpdated'), { description: t('passwordUpdatedDesc') });
        } catch (err: any) {
            const msg = err.message || t('networkError');
            setError(msg);
            toast.error(t('couldNotReset'), { description: msg });
        } finally {
            setUpdateLoading(false);
        }
    };

    // Mode 1: Set New Password (user arrived via token in URL)
    if (token) {
        return (
            <Card>
                <CardHeader className="flex-col items-stretch gap-0 pb-2 pt-7 text-center sm:px-8">
                    <span className="mx-auto grid size-14 place-items-center rounded-card bg-primary-subtle text-primary">
                        <KeyRound className="size-7" />
                    </span>
                    <CardTitle as="h1" className="mt-5 text-display-sm">
                        {t('setNewPasswordTitle')}
                    </CardTitle>
                    <CardDescription>{t('setNewPasswordSubtitle')}</CardDescription>
                </CardHeader>

                <CardContent className="pt-5 sm:px-8">
                    {error && (
                        <Alert tone="danger" className="mb-5">
                            {error}
                        </Alert>
                    )}

                    {updateSuccess ? (
                        <div className="animate-fade-in space-y-4">
                            <Alert
                                tone="success"
                                icon={<CheckCircle2 />}
                                title={t('passwordUpdated')}
                            >
                                {t('passwordUpdatedDesc')}
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
                            <form onSubmit={handleUpdatePassword} className="space-y-4">
                                <Field label={t('newPassword')} htmlFor="newPassword" required>
                                    <Input
                                        id="newPassword"
                                        type="password"
                                        required
                                        autoComplete="new-password"
                                        leadingIcon={<Lock />}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder={t('newPasswordPlaceholder')}
                                    />
                                </Field>

                                <Field label={t('confirmPassword')} htmlFor="confirmPassword" required>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        required
                                        autoComplete="new-password"
                                        leadingIcon={<Lock />}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder={t('confirmPasswordPlaceholder')}
                                    />
                                </Field>

                                <Button
                                    type="submit"
                                    size="lg"
                                    block
                                    loading={updateLoading}
                                    className="mt-2"
                                >
                                    {updateLoading ? t('updatingPassword') : t('updatePassword')}
                                </Button>
                            </form>

                            <p className="mt-6 text-center text-sm">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setError(null);
                                        if (typeof window !== 'undefined') {
                                            window.history.replaceState(null, '', window.location.pathname);
                                            window.dispatchEvent(new Event('popstate'));
                                        }
                                    }}
                                    className="font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                                >
                                    {t('requestNewLink')}
                                </button>
                            </p>
                        </>
                    )}
                </CardContent>
            </Card>
        );
    }

    // Mode 2: Request Password Reset (no token in URL)
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

                {requestSuccess ? (
                    <div className="animate-fade-in space-y-4">
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
                        <form onSubmit={handleRequestReset} className="space-y-4">
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
                                loading={requestLoading}
                                className="mt-2"
                            >
                                {requestLoading ? t('sending') : t('sendLink')}
                            </Button>
                        </form>

                        <div className="mt-6 flex flex-col items-center gap-2 text-center text-sm">
                            <p className="text-muted-foreground">
                                {t('rememberPassword')}{' '}
                                <Link
                                    href="/login"
                                    className="font-semibold text-primary underline-offset-4 transition-colors hover:underline"
                                >
                                    {t('signIn')}
                                </Link>
                            </p>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
