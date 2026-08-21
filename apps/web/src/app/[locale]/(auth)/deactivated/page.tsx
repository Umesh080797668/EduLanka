'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    ArrowLeft,
    CheckCircle2,
    MessageSquare,
    Send,
    ShieldAlert,
} from 'lucide-react';
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
import { Textarea } from '@/components/ui/Form';
import { Spinner } from '@/components/ui/Spinner';

function DeactivatedContent() {
    const t = useTranslations('Deactivated');
    const tc = useTranslations('Common');
    const searchParams = useSearchParams();

    const role = searchParams?.get('role') || '';
    const tenantId = searchParams?.get('tenantId');
    const userId = searchParams?.get('userId');
    const reason = searchParams?.get('reason');

    const isSchoolAdmin = role === 'SCHOOL_ADMIN';

    const [isAppealing, setIsAppealing] = useState(false);
    const [appealText, setAppealText] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
        'idle',
    );
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmitAppeal = async () => {
        if (!appealText.trim() || !tenantId || !userId) return;
        setStatus('loading');
        try {
            await apiClient.post(
                '/auth/inquiries',
                { tenantId, userId, role, message: appealText.trim() },
                { skipGlobalToast: true },
            );
            setStatus('success');
            toast.success(t('inquiryForwarded'), {
                description: t('inquiryForwardedDesc'),
            });
        } catch (err: any) {
            setStatus('error');
            const msg = err.message || t('failedDefault');
            setErrorMsg(msg);
            toast.error(t('inquiryFailed'), { description: msg });
        }
    };

    return (
        <Card>
            <CardHeader className="flex-col items-stretch gap-0 pb-2 pt-7 text-center sm:px-8">
                <span className="mx-auto grid size-14 place-items-center rounded-card bg-destructive-subtle text-destructive">
                    <ShieldAlert className="size-7" />
                </span>
                <CardTitle as="h1" className="mt-5 text-display-sm">
                    {t('title')}
                </CardTitle>
                <CardDescription>{t('subtitle')}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 pt-5 sm:px-8">
                {reason && (
                    <Alert tone="danger" title={t('reasonLabel')}>
                        {reason}
                    </Alert>
                )}

                {status === 'success' ? (
                    <Alert
                        tone="success"
                        icon={<CheckCircle2 />}
                        title={t('submitted')}
                        className="animate-fade-in"
                    >
                        {t('submittedNote')}
                    </Alert>
                ) : isAppealing ? (
                    <div className="animate-fade-in space-y-3">
                        <Textarea
                            autoFocus
                            rows={4}
                            value={appealText}
                            onChange={(e) => setAppealText(e.target.value)}
                            disabled={status === 'loading'}
                            invalid={status === 'error'}
                            placeholder={t('appealPlaceholder')}
                            aria-label={t('submitInquiry')}
                        />

                        {status === 'error' && (
                            <p className="text-xs font-medium text-destructive">
                                {errorMsg}
                            </p>
                        )}

                        <div className="flex gap-2.5">
                            <Button
                                variant="outline"
                                className="flex-1"
                                disabled={status === 'loading'}
                                onClick={() => {
                                    setIsAppealing(false);
                                    setStatus('idle');
                                }}
                            >
                                {tc('cancel')}
                            </Button>
                            <Button
                                className="flex-[2]"
                                loading={status === 'loading'}
                                disabled={!appealText.trim()}
                                leadingIcon={<Send />}
                                onClick={handleSubmitAppeal}
                            >
                                {status === 'loading' ? t('sending') : t('sendMessage')}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        <Button
                            size="lg"
                            block
                            leadingIcon={<MessageSquare />}
                            onClick={() => setIsAppealing(true)}
                        >
                            {t('submitInquiry')}
                        </Button>
                        {!isSchoolAdmin && (
                            <p className="px-2 text-center text-xs leading-relaxed text-muted-foreground">
                                {t('inquiryNote')}
                            </p>
                        )}
                    </div>
                )}

                <Link
                    href="/login"
                    className={buttonClass({
                        variant: isAppealing || status === 'success' ? 'ghost' : 'outline',
                        size: 'lg',
                        block: true,
                    })}
                >
                    <ArrowLeft className="size-[18px]" />
                    {t('returnLogin')}
                </Link>
            </CardContent>
        </Card>
    );
}

export default function DeactivatedAccountPage() {
    return (
        <Suspense
            fallback={
                <div className="grid min-h-64 place-items-center">
                    <Spinner />
                </div>
            }
        >
            <DeactivatedContent />
        </Suspense>
    );
}
