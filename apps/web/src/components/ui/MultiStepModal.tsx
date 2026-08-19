'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

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

export default function MultiStepModal({ isOpen, onClose, title, steps, onComplete }: MultiStepModalProps) {
    const t = useTranslations('Common');
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(0);
            setIsLoading(false);
            setError(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleNext = async () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep((prev) => prev + 1);
        } else {
            setIsLoading(true);
            setError(null);
            try {
                await onComplete();
                onClose();
            } catch (err: any) {
                setError(err.message || t('errors.unknown'));
            } finally {
                setIsLoading(false);
            }
        }
    };

    const step = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl text-slate-800"
                >
                    <div className="relative flex items-center justify-between border-b border-slate-100 p-5 bg-slate-50/50">
                        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-50"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6">
                        <div className="mb-6 flex gap-2">
                            {steps.map((_, idx) => (
                                <div key={idx} className="h-1 flex-1 rounded-full bg-slate-100 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: idx <= currentStep ? '100%' : '0%' }}
                                        className={`h-full rounded-full ${step?.isDestructive ? 'bg-rose-500' : 'bg-primary-500'}`}
                                    />
                                </div>
                            ))}
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col items-center text-center p-4 bg-slate-50/50 rounded-xl"
                            >
                                <div className={`mb-4 rounded-full p-4 ${step.isDestructive ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {step.isDestructive ? <AlertTriangle className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
                                </div>
                                <h3 className="mb-2 text-xl font-bold text-slate-800">{step.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>

                                {error && (
                                    <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 w-full text-left">
                                        {error}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="flex gap-3 border-t border-slate-100 p-5 bg-slate-50">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-all"
                        >
                            {t('buttons.cancel', { fallback: 'Cancel' })}
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={isLoading}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-50 transition-all ${step.isDestructive
                                    ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                                    : 'bg-primary-600 hover:bg-primary-700 active:bg-primary-800'
                                }`}
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    {step.confirmText}
                                    {!isLastStep && <ChevronRight className="h-4 w-4" />}
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
