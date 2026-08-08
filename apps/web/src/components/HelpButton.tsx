'use client';
import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useTutorial } from './TutorialProvider';
import { useTranslations } from 'next-intl';

export const HelpButton: React.FC = () => {
    const { startTutorial } = useTutorial();
    const t = useTranslations('TutorialTour');

    return (
        <button
            onClick={startTutorial}
            className="fixed bottom-6 right-6 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition z-50 focus:outline-none focus:ring-4 focus:ring-blue-300"
            aria-label={t('help') || 'Help'}
            title={t('help') || 'Help'}
        >
            <HelpCircle size={24} />
        </button>
    );
};
