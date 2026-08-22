'use client';
import { authManager } from '@/lib/auth-store';

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

    const getToken = () => typeof window !== 'undefined' ? authManager.getToken() : null;
    const getTenantId = () => typeof window !== 'undefined' ? authManager.getTenantId() : null;
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

                // SUPER_ADMIN sessions carry no tenancy, so the API deliberately
                // refuses to persist their tour state. Without a local fallback the
                // tour would either never start (nothing to check against) or replay
                // on every visit, so remember it in this browser instead.
                const localKey = `edulanka:tour:${tutData.id}`;
                const readLocal = () => {
                    try {
                        return window.localStorage.getItem(localKey);
                    } catch {
                        return null;
                    }
                };
                const finish = (status: 'COMPLETED' | 'SKIPPED') => {
                    if (tenantId) {
                        markCompleteOrSkip(status, tutData.id, tenantId, token);
                        return;
                    }
                    try {
                        window.localStorage.setItem(localKey, status);
                    } catch {
                        // Private browsing — the tour simply shows again next time.
                    }
                };

                driverObj.current = driver({
                    showProgress: true,
                    steps: formattedSteps,
                    nextBtnText: t('next'),
                    prevBtnText: t('previous'),
                    doneBtnText: t('done'),
                    allowClose: true,
                    // Opts the popover into the themed overrides in styles/tokens.css.
                    popoverClass: 'edulanka-tour',
                    onPopoverRender: (popover) => {
                        const skipBtn = document.createElement("button");
                        skipBtn.type = 'button';
                        skipBtn.innerText = t('skip');
                        skipBtn.className = "driver-skip-btn";
                        skipBtn.onclick = () => {
                            isSkippedFlag.current = true;
                            finish('SKIPPED');
                            driverObj.current?.destroy();
                        };
                        if (popover.footerButtons) {
                            popover.footerButtons.appendChild(skipBtn);
                        }
                    },
                    onDestroyStarted: () => {
                        const activeIndex = driverObj.current?.getActiveIndex() ?? 0;
                        if (!isSkippedFlag.current && activeIndex === formattedSteps.length - 1) {
                            finish('COMPLETED');
                        }
                        driverObj.current?.destroy();
                    }
                });

                // 2. Suppress the tour for anyone who has already been through it.
                // The local flag is the fallback; a tenanted session always defers
                // to the server so progress follows the user across devices.
                let alreadySeen = readLocal() !== null;
                if (tenantId) {
                    const completions: any = await apiClient.get('/me/tutorials', { token, tenantId });
                    alreadySeen = completions.some(
                        (c: any) =>
                            c.tutorial_id === tutData.id &&
                            (c.status === 'COMPLETED' || c.status === 'SKIPPED'),
                    );
                }

                if (!alreadySeen) {
                    // Add a small delay so Next.js hydration completes and elements are mounted
                    setTimeout(() => {
                        if (driverObj.current) driverObj.current.drive();
                    }, 1000);
                }
            } catch (err: any) {
                if (err?.message && (err.message.includes('No active tutorial found') || err.message.includes('Not Found'))) {
                    // silently ignore 404s for tutorials that are not seeded
                    return;
                }
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
