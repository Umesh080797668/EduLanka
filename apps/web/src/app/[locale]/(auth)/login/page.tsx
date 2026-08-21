'use client';

import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link, useRouter } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { authManager } from '@/lib/auth-store';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Form';

/** Role → portal route. The admin portals don't match their lowercased role. */
const PORTAL_BY_ROLE: Record<string, string> = {
    STUDENT: '/student',
    PARENT: '/parent',
    TEACHER: '/teacher',
    SCHOOL_ADMIN: '/institution-admin',
    SUPER_ADMIN: '/system-admin',
};

export default function LoginPage() {
    const router = useRouter();
    const t = useTranslations('Login');
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const data = await apiClient.post<any>(
                '/auth/login',
                { identifier, password },
                { skipGlobalToast: true },
            );

            const { accessToken, user } = data;
            const role = user?.role || 'STUDENT';

            authManager.setAuth(accessToken, user?.tenantId || '', role, user?.id || '');

            toast.success(t('welcomeBack'), { description: t('signInSuccess') });
            router.push(PORTAL_BY_ROLE[role] ?? '/dashboard');
        } catch (err: any) {
            const backendMessage = err.message || t('networkError');

            // The API encodes the suspension payload after a pipe.
            if (backendMessage.startsWith('User account is deactivated|')) {
                try {
                    const payload = JSON.parse(backendMessage.split('|')[1]);
                    const query = new URLSearchParams({
                        role: payload.role ?? 'STUDENT',
                        tenantId: payload.tenantId ?? '',
                        userId: payload.userId ?? '',
                        reason: payload.reason ?? '',
                    });
                    router.push(`/deactivated?${query.toString()}`);
                } catch {
                    router.push('/deactivated?role=STUDENT');
                }
                return;
            }

            setError(backendMessage);
            toast.error(t('invalidCreds'), { description: backendMessage });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex-col items-stretch gap-0 pb-2 pt-7 text-center sm:px-8">
                <span className="mx-auto grid size-14 place-items-center rounded-card bg-primary text-primary-foreground shadow-card">
                    <GraduationCap className="size-7" />
                </span>
                <CardTitle as="h1" className="mt-5 text-display-sm">
                    {t('welcome')}
                </CardTitle>
                <CardDescription>{t('subtitle')}</CardDescription>
            </CardHeader>

            <CardContent className="pt-5 sm:px-8">
                {error && (
                    <Alert tone="danger" className="mb-5">
                        {error}
                    </Alert>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <Field label={t('identifierLabel')} htmlFor="identifier" required>
                        <Input
                            id="identifier"
                            type="text"
                            required
                            autoComplete="username"
                            autoFocus
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder={t('identifierPlaceholder')}
                        />
                    </Field>

                    <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                            <label
                                htmlFor="password"
                                className="block text-[13px] font-semibold text-foreground"
                            >
                                {t('password')}
                                <span className="ml-0.5 text-destructive" aria-hidden>
                                    *
                                </span>
                            </label>
                            <Link
                                href="/reset-password"
                                className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                            >
                                {t('forgotPassword')}
                            </Link>
                        </div>
                        <Input
                            id="password"
                            type="password"
                            required
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t('passwordPlaceholder')}
                        />
                    </div>

                    <Button
                        type="submit"
                        size="lg"
                        block
                        loading={loading}
                        className="mt-2"
                    >
                        {loading ? t('authenticating') : t('signIn')}
                    </Button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                    {t('noAccount')}{' '}
                    <Link
                        href="/signup"
                        className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                        {t('signUpHere')}
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
