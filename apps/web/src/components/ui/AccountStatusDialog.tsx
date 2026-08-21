'use client';

import { useEffect, useState } from 'react';
import { ShieldOff, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Form';

interface AccountStatusDialogProps {
    open: boolean;
    onClose: () => void;
    /** Current state of the account — drives the whole copy set. */
    isActive: boolean;
    name: string;
    loading?: boolean;
    /** Reason is always passed; it is an empty string when reactivating. */
    onConfirm: (reason: string) => void | Promise<void>;
}

/**
 * Two-step suspend / reactivate gate shared by every account detail screen.
 * Reactivation is a single confirmation; suspension adds a reason step whose
 * text is surfaced to the user at their next sign-in attempt.
 */
export function AccountStatusDialog({
    open,
    onClose,
    isActive,
    name,
    loading = false,
    onConfirm,
}: AccountStatusDialogProps) {
    const t = useTranslations('AccountStatus');
    const tc = useTranslations('Common');
    const [step, setStep] = useState<1 | 2>(1);
    const [reason, setReason] = useState('');

    // Reset whenever the dialog is (re)opened so a stale reason never leaks.
    useEffect(() => {
        if (open) {
            setStep(1);
            setReason('');
        }
    }, [open]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            size="sm"
            tone={isActive ? 'danger' : 'primary'}
            icon={isActive ? <ShieldOff /> : <ShieldCheck />}
            title={isActive ? t('suspendTitle') : t('reactivateTitle')}
            dismissible={!loading}
        >
            {step === 1 ? (
                <>
                    <p className="text-sm text-muted-foreground">
                        {isActive
                            ? t('suspendQuestion', { name })
                            : t('reactivateQuestion', { name })}{' '}
                        {isActive ? t('loseAccess') : t('regainAccess')}
                    </p>

                    <div className="mt-6 flex justify-end gap-3">
                        <Button variant="outline" onClick={onClose} disabled={loading}>
                            {tc('cancel')}
                        </Button>
                        <Button
                            variant={isActive ? 'destructive' : 'primary'}
                            loading={!isActive && loading}
                            onClick={() => (isActive ? setStep(2) : onConfirm(''))}
                        >
                            {isActive ? t('proceedToSuspend') : t('yesReactivate')}
                        </Button>
                    </div>
                </>
            ) : (
                <>
                    <Field
                        label={t('reasonTitle')}
                        hint={t('reasonPrompt')}
                        htmlFor="suspend-reason"
                    >
                        <Textarea
                            id="suspend-reason"
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={t('enterReason')}
                            data-autofocus
                        />
                    </Field>

                    <div className="mt-6 flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setStep(1)}
                            disabled={loading}
                        >
                            {tc('back')}
                        </Button>
                        <Button
                            variant="destructive"
                            loading={loading}
                            onClick={() => onConfirm(reason)}
                        >
                            {t('confirmSuspension')}
                        </Button>
                    </div>
                </>
            )}
        </Dialog>
    );
}

export default AccountStatusDialog;
