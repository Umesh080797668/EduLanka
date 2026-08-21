'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Mail, User, UserCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link, useRouter } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { authManager } from '@/lib/auth-store';
import { cn } from '@/lib/cn';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/Card';
import { Field, Input, Label, Select } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/Layout';
import { Spinner } from '@/components/ui/Spinner';

const PORTAL_BY_ROLE: Record<string, string> = {
    STUDENT: '/student',
    PARENT: '/parent',
};

export default function SignupPage() {
    const router = useRouter();
    const t = useTranslations('Signup');

    const [tenants, setTenants] = useState<any[]>([]);
    const [loadingTenants, setLoadingTenants] = useState(true);

    const [tenantId, setTenantId] = useState('');
    const [role, setRole] = useState<'STUDENT' | 'PARENT'>('STUDENT');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTenants = async () => {
            try {
                const data = await apiClient.get<any[]>('/auth/tenants', {
                    skipGlobalToast: true,
                });
                setTenants(data || []);
            } catch (err) {
                console.error('Failed to load public tenants', err);
            } finally {
                setLoadingTenants(false);
            }
        };
        fetchTenants();
    }, []);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const data = await apiClient.post<any>(
                '/auth/self-register',
                { email, password, fullName, tenantId, role },
                { skipGlobalToast: true },
            );

            const { accessToken, user } = data;
            const savedRole = user?.role || role;

            authManager.setAuth(
                accessToken,
                user?.tenantId || '',
                savedRole,
                user?.id || '',
            );

            toast.success(t('accountCreated'), { duration: 5000 });
            router.push(PORTAL_BY_ROLE[savedRole] ?? '/dashboard');
        } catch (err: any) {
            const backendMessage = err.message || t('networkError');
            setError(backendMessage);
            toast.error(t('registrationFailed'), {
                description: backendMessage,
                duration: 5000,
            });
        } finally {
            setLoading(false);
        }
    };

    const ROLES: { value: 'STUDENT' | 'PARENT'; label: string }[] = [
        { value: 'STUDENT', label: t('student') },
        { value: 'PARENT', label: t('parent') },
    ];

    return (
        <Card>
            <CardHeader className="flex-col items-stretch gap-0 pb-2 pt-7 sm:px-8">
                <span className="grid size-12 place-items-center rounded-card bg-primary text-primary-foreground shadow-card">
                    <UserCircle2 className="size-6" />
                </span>
                <CardTitle as="h1" className="mt-5 text-display-sm">
                    {t('title')}
                </CardTitle>
                <CardDescription>{t('subtitle')}</CardDescription>
            </CardHeader>

            <CardContent className="pt-5 sm:px-8">
                {loadingTenants ? (
                    <div className="py-10">
                        <Spinner text={t('discovering')} />
                    </div>
                ) : tenants.length === 0 ? (
                    <EmptyState
                        icon={<Building2 />}
                        title={t('noSchools')}
                        action={
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                            >
                                <ArrowLeft className="size-4" />
                                {t('returnLogin')}
                            </Link>
                        }
                    />
                ) : (
                    <>
                        {error && (
                            <Alert tone="danger" className="mb-5">
                                {error}
                            </Alert>
                        )}

                        <form onSubmit={handleSignup} className="space-y-4">
                            <Field label={t('selectSchool')} htmlFor="tenant" required>
                                <Select
                                    id="tenant"
                                    required
                                    value={tenantId}
                                    onChange={(e) => setTenantId(e.target.value)}
                                >
                                    <option value="" disabled>
                                        {t('choosePlaceholder')}
                                    </option>
                                    {tenants.map((tenant) => (
                                        <option key={tenant.id} value={tenant.id}>
                                            {tenant.name}
                                        </option>
                                    ))}
                                </Select>
                            </Field>

                            <div className="space-y-1.5">
                                <Label>{t('iAmA')}</Label>
                                <div
                                    role="radiogroup"
                                    aria-label={t('iAmA')}
                                    className="grid grid-cols-2 gap-2.5"
                                >
                                    {ROLES.map((option) => {
                                        const active = role === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={active}
                                                onClick={() => setRole(option.value)}
                                                className={cn(
                                                    'rounded-input border px-3 py-2.5 text-sm font-semibold transition-colors',
                                                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                                                    active
                                                        ? 'border-primary bg-primary-subtle text-primary-subtle-foreground'
                                                        : 'border-input bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                                                )}
                                            >
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <Field label={t('fullName')} htmlFor="fullName" required>
                                <Input
                                    id="fullName"
                                    type="text"
                                    required
                                    autoComplete="name"
                                    leadingIcon={<User />}
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder={t('fullNamePlaceholder')}
                                />
                            </Field>

                            <Field label={t('emailLabel')} htmlFor="email" required>
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

                            <Field
                                label={t('passwordLabel')}
                                htmlFor="password"
                                required
                                hint={t('passwordPlaceholder')}
                            >
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </Field>

                            <Button
                                type="submit"
                                size="lg"
                                block
                                loading={loading}
                                disabled={!tenantId}
                                trailingIcon={<ArrowRight />}
                                className="mt-2"
                            >
                                {loading ? t('creating') : t('createAccount')}
                            </Button>
                        </form>

                        <p className="mt-6 text-center text-sm text-muted-foreground">
                            {t('haveAccount')}{' '}
                            <Link
                                href="/login"
                                className="font-semibold text-primary underline-offset-4 hover:underline"
                            >
                                {t('signIn')}
                            </Link>
                        </p>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
