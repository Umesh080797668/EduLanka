'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useTutorial } from './TutorialProvider';

export const HelpButton: React.FC = () => {
    const { startTutorial } = useTutorial();
    const t = useTranslations('TutorialTour');

    return (
        <button
            type="button"
            onClick={startTutorial}
            aria-label={t('help')}
            title={t('help')}
            className="fixed bottom-6 right-6 z-40 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-modal transition-[background-color,transform] hover:bg-primary-hover active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
            <HelpCircle className="size-6" />
        </button>
    );
};
