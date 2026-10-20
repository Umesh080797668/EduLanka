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
        let isMounted = true;
        let driveTimer: ReturnType<typeof setTimeout> | null = null;

        const loadTutorial = async () => {
            const token = getToken();
            const tenantId = getTenantId();
            if (!token) return;
            try {
                // 1. Fetch tutorial data
                const tutData: any = await apiClient.get(`/tutorials/${role}/${screenId}`, { token });
                if (!tutData || !tutData.id || !Array.isArray(tutData.steps) || tutData.steps.length === 0) return;

                // Read current tenant plan for plan-aware content
                const currentPlan = authManager.getPlan() || 'COMMUNITY';
                const planWeights: Record<string, number> = {
                    COMMUNITY: 1,
                    STARTER: 2,
                    GROWTH: 3,
                    INSTITUTIONAL: 4,
                };
                const userWeight = planWeights[currentPlan.toUpperCase()] || 1;

                // Format steps for driver.js with localization & plan awareness
                const formattedSteps: DriveStep[] = tutData.steps.map((s: any) => {
                    let title = s[`title_${locale}`] || s.title_en || '';
                    let description = s[`content_${locale}`] || s.content_en || '';

                    if (s.min_plan && s.min_plan !== 'COMMUNITY') {
                        const requiredWeight = planWeights[s.min_plan.toUpperCase()] || 2;
                        if (userWeight < requiredWeight) {
                            title = `${title} [${s.min_plan}+]`;
                            description = `${description}\n\n⭐ (Requires ${s.min_plan} plan subscription)`;
                        }
                    }

                    return {
                        element: s.target_element || undefined,
                        popover: {
                            title,
                            description,
                            side: "left",
                            align: 'start'
                        }
                    };
                });

                if (!isMounted) return;
                setSteps(formattedSteps);

                // Key tour states strictly per user to prevent one user's dismissal
                // from silencing tours for other users on shared school browsers.
                const userId = (typeof window !== 'undefined' ? authManager.getUserId() : null) || 'anonymous';
                const localKey = `edulanka:tour:${userId}:${tutData.id}`;
                const dismissKey = `edulanka:tour:dismiss:${userId}:${tutData.id}`;
                const screenDismissKey = `edulanka:tour:dismiss:${userId}:${screenId}`;

                const isDismissed = () => {
                    try {
                        return (
                            window.localStorage.getItem(dismissKey) === 'true' ||
                            window.localStorage.getItem(screenDismissKey) === 'true'
                        );
                    } catch {
                        return false;
                    }
                };

                const readLocal = () => {
                    try {
                        return window.localStorage.getItem(localKey);
                    } catch {
                        return null;
                    }
                };
                const finish = (status: 'COMPLETED' | 'SKIPPED') => {
                    try {
                        window.localStorage.setItem(localKey, status);
                    } catch { }
                    if (tenantId) {
                        markCompleteOrSkip(status, tutData.id, tenantId, token);
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
                        const dontShowBtn = document.createElement("button");
                        dontShowBtn.type = 'button';
                        dontShowBtn.innerText = t('dontShowAgain');
                        dontShowBtn.className = "driver-dont-show-btn";
                        dontShowBtn.onclick = () => {
                            isSkippedFlag.current = true;
                            try {
                                window.localStorage.setItem(dismissKey, 'true');
                                window.localStorage.setItem(screenDismissKey, 'true');
                            } catch { }
                            finish('SKIPPED');
                            driverObj.current?.destroy();
                        };

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
                            popover.footerButtons.prepend(dontShowBtn);
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

                // 2. Suppress the tour for anyone who has already been through it or dismissed it.
                // The local flag is the fallback; a tenanted session always defers
                // to the server so progress follows the user across devices.
                let alreadySeen = readLocal() !== null || isDismissed();
                if (tenantId && !alreadySeen) {
                    const completions: any = await apiClient.get('/me/tutorials', { token, tenantId });
                    alreadySeen = completions.some(
                        (c: any) =>
                            c.tutorial_id === tutData.id &&
                            (c.status === 'COMPLETED' || c.status === 'SKIPPED'),
                    );
                }

                if (!alreadySeen && isMounted) {
                    // Add a small delay so Next.js hydration completes and elements are mounted
                    driveTimer = setTimeout(() => {
                        if (isMounted && driverObj.current) driverObj.current.drive();
                    }, 1000);
                }
            } catch (err: any) {
                if (err?.message && (err.message.includes('No active tutorial found') || err.message.includes('Not Found') || err.message.includes('404'))) {
                    // silently ignore 404s for tutorials that are not seeded
                    return;
                }
                if (process.env.NODE_ENV === 'test' && (err?.name === 'ReferenceError' || err?.message?.includes('fetch is not defined'))) {
                    return;
                }
                console.error('Failed to load tutorial:', err);
            }
        };
        loadTutorial();

        return () => {
            isMounted = false;
            if (driveTimer) clearTimeout(driveTimer);
            if (driverObj.current) {
                try {
                    driverObj.current.destroy();
                } catch { }
            }
        };
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
