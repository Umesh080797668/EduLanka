'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { apiClient } from '../lib/api-client';
import { useTranslations, useLocale } from 'next-intl';

interface TutorialContextType {
    startTutorial: () => void;
    currentScreenId: string | null;
}

const TutorialContext = createContext<TutorialContextType>({
    startTutorial: () => { },
    currentScreenId: null,
});

export const useTutorial = () => useContext(TutorialContext);

interface TutorialProviderProps {
    children: React.ReactNode;
    role: string;
    screenId: string;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({
    children, role, screenId
}) => {
    const locale = useLocale();
    const t = useTranslations('TutorialTour');
    const driverObj = useRef<any>(null);

    const [steps, setSteps] = useState<DriveStep[]>([]);

    const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const getTenantId = () => typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
    const isSkippedFlag = useRef(false);

    const markCompleteOrSkip = useCallback(async (status: 'COMPLETED' | 'SKIPPED', tutId: string, tenantIdStr: string, tokenStr: string) => {
        try {
            await apiClient.post(`/me/tutorials/${tutId}/status`, { status }, { token: tokenStr, tenantId: tenantIdStr });
        } catch (err) {
            console.error('Failed to mark tutorial status', err);
        }
    }, []);

    useEffect(() => {
        const loadTutorial = async () => {
            const token = getToken();
            const tenantId = getTenantId();
            if (!token) return;
            try {
                // 1. Fetch tutorial data
                const tutData: any = await apiClient.get(`/tutorials/${role}/${screenId}`, { token });
                if (!tutData || !tutData.id || tutData.steps.length === 0) return;

                // Format steps for driver.js with localization
                const formattedSteps: DriveStep[] = tutData.steps.map((s: any) => ({
                    element: s.target_element || undefined,
                    popover: {
                        title: s[`title_${locale}`] || s.title_en,
                        description: s[`content_${locale}`] || s.content_en,
                        side: "left",
                        align: 'start'
                    }
                }));

                setSteps(formattedSteps);

                driverObj.current = driver({
                    showProgress: true,
                    steps: formattedSteps,
                    nextBtnText: t('next'),
                    prevBtnText: t('previous'),
                    doneBtnText: t('done'),
                    allowClose: true,
                    onPopoverRender: (popover) => {
                        const skipBtn = document.createElement("button");
                        skipBtn.innerText = t('skip');
                        skipBtn.className = "driver-skip-btn !ml-2 text-sm text-gray-500 hover:text-gray-700";
                        skipBtn.onclick = () => {
                            isSkippedFlag.current = true;
                            if (tenantId) markCompleteOrSkip('SKIPPED', tutData.id, tenantId, token);
                            driverObj.current?.destroy();
                        };
                        if (popover.footerButtons) {
                            popover.footerButtons.appendChild(skipBtn);
                        }
                    },
                    onDestroyStarted: () => {
                        const activeIndex = driverObj.current?.getActiveIndex() ?? 0;
                        if (!isSkippedFlag.current && activeIndex === formattedSteps.length - 1) {
                            if (tenantId) markCompleteOrSkip('COMPLETED', tutData.id, tenantId, token);
                        }
                        if (driverObj.current?.hasNextStep() || isSkippedFlag.current) {
                            driverObj.current?.destroy();
                        } else {
                            driverObj.current?.destroy();
                        }
                    }
                });

                // 2. Check if already completed
                if (tenantId) {
                    const completions: any = await apiClient.get('/me/tutorials', { token, tenantId });
                    const isCompleted = completions.some((c: any) => c.tutorial_id === tutData.id && c.status === 'COMPLETED');
                    const isSkipped = completions.some((c: any) => c.tutorial_id === tutData.id && c.status === 'SKIPPED');

                    if (!isCompleted && !isSkipped) {
                        // Add a small delay so Next.js hydration completes and elements are mounted
                        setTimeout(() => {
                            if (driverObj.current) driverObj.current.drive();
                        }, 1000);
                    }
                }
            } catch (err) {
                console.error('Failed to load tutorial:', err);
            }
        };
        loadTutorial();
    }, [role, screenId, locale, t, markCompleteOrSkip]);

    const startTutorial = useCallback(() => {
        if (driverObj.current && steps.length > 0) {
            driverObj.current.drive();
        }
    }, [steps]);

    return (
        <TutorialContext.Provider value={{ startTutorial, currentScreenId: screenId }}>
            {children}
        </TutorialContext.Provider>
    );
};
