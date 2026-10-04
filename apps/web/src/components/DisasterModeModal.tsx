'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Form';

interface DisasterModeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string, resumeDate: string) => void;
}

export function DisasterModeModal({
    isOpen,
    onClose,
    onConfirm,
}: DisasterModeModalProps) {
    const t = useTranslations('DisasterMode');
    const tc = useTranslations('Common');
    const [reason, setReason] = useState('FLOOD');
    const [resumeDate, setResumeDate] = useState('');
    const [confirming, setConfirming] = useState(false);

    return (
        <>
            <Dialog
                open={isOpen}
                onClose={onClose}
                tone="danger"
                icon={<AlertTriangle />}
                title={t('title')}
                description={t('subtitle')}
                footer={
                    <Button
                        variant="destructive"
                        block
                        leadingIcon={<AlertTriangle />}
                        onClick={() => setConfirming(true)}
                    >
                        {t('initiate')}
                    </Button>
                }
            >
                <div className="space-y-5">
                    <Field
                        label={t('reasonLabel')}
                        hint={t('reasonHint')}
                        htmlFor="disaster-reason"
                        required
                    >
                        <Select
                            id="disaster-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        >
                            <option value="FLOOD">{t('flood')}</option>
                            <option value="CYCLONE">{t('cyclone')}</option>
                            <option value="LANDSLIDE">{t('landslide')}</option>
                            <option value="CIVIL_PUBLIC_HEALTH">
                                {t('publicHealth')}
                            </option>
                            <option value="OTHER">{t('other')}</option>
                        </Select>
                    </Field>

                    <Field
                        label={t('resumeLabel')}
                        hint={t('resumeHint')}
                        htmlFor="disaster-resume"
                    >
                        <Input
                            id="disaster-resume"
                            type="date"
                            value={resumeDate}
                            onChange={(e) => setResumeDate(e.target.value)}
                        />
                    </Field>
                </div>
            </Dialog>

            {/* Second gate — this broadcast cannot be recalled. */}
            <ConfirmDialog
                open={confirming}
                onClose={() => setConfirming(false)}
                onConfirm={() => {
                    setConfirming(false);
                    onConfirm(reason, resumeDate);
                }}
                icon={<AlertTriangle />}
                title={t('confirmTitle')}
                description={t('confirmBody')}
                confirmLabel={t('confirmYes')}
                cancelLabel={tc('cancel')}
            />
        </>
    );
}
