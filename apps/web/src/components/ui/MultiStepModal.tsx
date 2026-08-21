'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

export interface MultiStepModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    steps: {
        title: string;
        description: string;
        confirmText: string;
        isDestructive?: boolean;
    }[];
    onComplete: () => Promise<void>;
}

/**
 * Staged confirmation for high-consequence actions — the user must clear every
 * step before `onComplete` fires.
 */
export default function MultiStepModal({
    isOpen,
    onClose,
    title,
    steps,
    onComplete,
}: MultiStepModalProps) {
    const t = useTranslations('Common');
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset when reopened so a previous run's step/error doesn't leak through.
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(0);
            setIsLoading(false);
            setError(null);
        }
    }, [isOpen]);

    const step = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;

    const handleNext = async () => {
        if (!isLastStep) {
            setCurrentStep((prev) => prev + 1);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            await onComplete();
            onClose();
        } catch (err: any) {
            setError(err.message || t('somethingWentWrong'));
        } finally {
            setIsLoading(false);
        }
    };

    if (!step) return null;

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            dismissible={!isLoading}
            tone={step.isDestructive ? 'danger' : 'warning'}
            footer={
                <>
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        variant={step.isDestructive ? 'destructive' : 'primary'}
                        className="flex-1"
                        loading={isLoading}
                        onClick={handleNext}
                        trailingIcon={!isLastStep ? <ChevronRight /> : undefined}
                        data-autofocus
                    >
                        {step.confirmText}
                    </Button>
                </>
            }
        >
            {/* Step progress */}
            <div
                className="mb-6 flex gap-2"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={steps.length}
                aria-valuenow={currentStep + 1}
            >
                {steps.map((_, idx) => (
                    <div
                        key={idx}
                        className="h-1 flex-1 overflow-hidden rounded-pill bg-muted"
                    >
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: idx <= currentStep ? '100%' : '0%' }}
                            transition={{ duration: 0.25 }}
                            className={cn(
                                'h-full rounded-pill',
                                step.isDestructive ? 'bg-destructive' : 'bg-primary',
                            )}
                        />
                    </div>
                ))}
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center rounded-card border border-border bg-muted/40 px-5 py-6 text-center"
                >
                    <span
                        className={cn(
                            'grid size-14 place-items-center rounded-full',
                            step.isDestructive
                                ? 'bg-destructive-subtle text-destructive-subtle-foreground'
                                : 'bg-warning-subtle text-warning-subtle-foreground',
                        )}
                        aria-hidden
                    >
                        <AlertTriangle className="size-7" />
                    </span>

                    <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
                        {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                    </p>

                    {error && (
                        <Alert tone="danger" className="mt-4 w-full text-left">
                            {error}
                        </Alert>
                    )}
                </motion.div>
            </AnimatePresence>
        </Dialog>
    );
}
