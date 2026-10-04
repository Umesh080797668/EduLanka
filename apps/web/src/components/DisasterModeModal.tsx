'use client';

import { useState } from 'react';
import { AlertTriangle, MessageSquare, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Form';

interface DisasterModeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string, resumeDate: string, language: 'EN' | 'SI' | 'TA') => void;
    schoolName?: string;
}

export function DisasterModeModal({
    isOpen,
    onClose,
    onConfirm,
    schoolName,
}: DisasterModeModalProps) {
    const t = useTranslations('DisasterMode');
    const tc = useTranslations('Common');
    const [reason, setReason] = useState('FLOOD');
    const [resumeDate, setResumeDate] = useState('');
    const [language, setLanguage] = useState<'EN' | 'SI' | 'TA'>('EN');
    const [confirming, setConfirming] = useState(false);

    const schoolDisplayName = schoolName || 'School';
    const reopenDisplay = resumeDate || (language === 'SI' ? 'නැවත දැනුම් දෙන තුරු' : language === 'TA' ? 'மறு அறிவித்தல் வரை' : 'further notice');

    let previewReason = '';
    let previewText = '';

    if (language === 'SI') {
        const siMap: Record<string, string> = {
            FLOOD: 'ගංවතුර තත්ත්වය',
            CYCLONE: 'සුළි සුළං අවදානම',
            LANDSLIDE: 'නායයෑමේ අවදානම',
            CIVIL_PUBLIC_HEALTH: 'හදිසි මහජන සෞඛ්‍ය/ආරක්ෂක හේතු',
            OTHER: 'හදිසි ආපදා තත්ත්වය',
        };
        previewReason = siMap[reason] || 'හදිසි ආපදා තත්ත්වය';
        previewText = `[හදිසි නිවේදනය] ${schoolDisplayName}: ${previewReason} හේතුවෙන් පාසල තාවකාලිකව වසා තැබේ. නැවත ආරම්භය: ${reopenDisplay}. ආරක්ෂිතව සිටින්න.`;
    } else if (language === 'TA') {
        const taMap: Record<string, string> = {
            FLOOD: 'வெள்ளப் பெருக்கு',
            CYCLONE: 'சூறாவளி எச்சரிக்கை',
            LANDSLIDE: 'மண்சரிவு அபாயம்',
            CIVIL_PUBLIC_HEALTH: 'பொதுச் சுகாதார அவசரநிலை',
            OTHER: 'அவசர அனர்த்த நிலைமை',
        };
        previewReason = taMap[reason] || 'அவசர அனர்த்த நிலைமை';
        previewText = `[அவசர அறிவித்தல்] ${schoolDisplayName}: ${previewReason} காரணமாக பாடசாலை தற்காலிகமாக மூடப்பட்டுள்ளது. மீள ஆரம்பம்: ${reopenDisplay}. பாதுகாப்பாக இருக்கவும்.`;
    } else {
        const enMap: Record<string, string> = {
            FLOOD: 'Flood conditions',
            CYCLONE: 'Cyclone alert',
            LANDSLIDE: 'Landslide warning',
            CIVIL_PUBLIC_HEALTH: 'Health and safety emergency',
            OTHER: 'Emergency closure',
        };
        previewReason = enMap[reason] || 'Emergency closure';
        previewText = `[EMERGENCY] ${schoolDisplayName}: School closed due to ${previewReason}. Expected to reopen on ${reopenDisplay}. Please stay safe.`;
    }

    const isUnicode = language === 'SI' || language === 'TA';
    const charCount = previewText.length;
    const estimatedSegments = isUnicode
        ? (charCount <= 70 ? 1 : Math.ceil(charCount / 67))
        : Math.max(1, Math.ceil(charCount / 160));

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
                        label={t('languageLabel')}
                        hint={t('languageHint')}
                        htmlFor="disaster-language"
                        required
                    >
                        <Select
                            id="disaster-language"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as 'EN' | 'SI' | 'TA')}
                        >
                            <option value="EN">{t('langEn')}</option>
                            <option value="SI">{t('langSi')}</option>
                            <option value="TA">{t('langTa')}</option>
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

                    {/* Live SMS Preview box with segment counter */}
                    <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                <MessageSquare className="size-3.5 text-primary" />
                                {t('smsPreview')}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground">
                                {charCount} {t('characters')} • {estimatedSegments} {t('segments')}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-foreground bg-background rounded border border-border/80 p-3 leading-relaxed whitespace-pre-wrap select-all">
                            {previewText}
                        </p>
                        {isUnicode && (
                            <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                                <Info className="size-3.5 shrink-0 mt-0.5" />
                                <span>{t('ucs2Warning')}</span>
                            </div>
                        )}
                    </div>
                </div>
            </Dialog>

            {/* Second gate — this broadcast cannot be recalled. */}
            <ConfirmDialog
                open={confirming}
                onClose={() => setConfirming(false)}
                onConfirm={() => {
                    setConfirming(false);
                    onConfirm(reason, resumeDate, language);
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
