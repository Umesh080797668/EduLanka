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

const BUILTIN_TOURS: Record<string, { id: string; steps: any[] }> = {
    'PARENT:grades': {
        id: 'builtin_parent_grades',
        steps: [
            {
                target_element: '#term-selector',
                title_en: 'Academic Term Selection',
                title_si: 'වාර තේරීම',
                title_ta: 'பருவத் தேர்வு',
                content_en: "Select Term 1, 2, or 3 to inspect your child's continuous evaluation marks and terminal performance.",
                content_si: 'ඔබගේ දරුවාගේ වාර ලකුණු පරීක්ෂා කිරීමට වාරය 1, 2, හෝ 3 තෝරන්න.',
                content_ta: 'உங்கள் பிள்ளையின் பருவ மதிப்பெண்களைப் பார்க்க பருவத்தைத் தேர்ந்தெடுக்கவும்.',
            },
            {
                target_element: 'table',
                title_en: 'Subject Marks & Evaluation',
                title_si: 'විෂය ලකුණු සහ ශ්‍රේණිගත කිරීම්',
                title_ta: 'பாட மதிப்பெண்கள் மற்றும் தரங்கள்',
                content_en: 'View detailed scores and Ministry-standard grade badges across all terminal subjects.',
                content_si: 'සියලුම විෂයයන් සඳහා සවිස්තරාත්මක ලකුණු සහ නිල ශ්‍රේණිගත කිරීම් පරීක්ෂා කරන්න.',
                content_ta: 'அனைத்துப் பாடங்களுக்குமான விரிவான மதிப்பெண்கள் மற்றும் தரங்களை இங்கே காணலாம்.',
            },
            {
                target_element: '#download-report-btn',
                title_en: 'Official PDF Report Card',
                title_si: 'නිල ප්‍රගති වාර්තාව බාගත කරන්න',
                title_ta: 'அதிகாரப்பூர்வ அறிக்கை அட்டை பதிவிறக்கம்',
                content_en: 'Download the certified student terminal report card complete with institutional seal and marks status.',
                content_si: 'පාසලේ නිල මුද්‍රාව සහිත සහතික කළ වාර ප්‍රගති වාර්තා පත්‍රිකාව PDF ආකාරයෙන් බාගත කරගන්න.',
                content_ta: 'பள்ளியின் அதிகாரப்பூர்வ முத்திரையுடன் கூடிய சான்றளிக்கப்பட்ட அறிக்கைப் புத்தகத்தை PDF ஆகப் பதிவிறக்கவும்.',
            },
        ],
    },
    'PARENT:chat_main': {
        id: 'builtin_parent_chat',
        steps: [
            {
                target_element: '#chat-conversation-list',
                title_en: 'Parent-Teacher Discussions',
                title_si: 'දෙමාපිය-ගුරු සාකච්ඡා',
                title_ta: 'பெற்றோர்-ஆசிரியர் உரையாடல்கள்',
                content_en: 'Access ongoing communication threads with your child’s homeroom and subject teachers.',
                content_si: 'ඔබගේ දරුවාගේ පන්තිභාර සහ විෂය භාර ගුරුවරුන් සමග පවතින සාකච්ඡා මෙතැනින් බලන්න.',
                content_ta: 'ஆசிரியர்களுடனான உங்கள் உரையாடல்களை இங்கே பார்வையிடலாம்.',
            },
            {
                target_element: '#chat-new-conversation',
                title_en: 'Initiate Teacher Discussion',
                title_si: 'නව සාකච්ඡාවක් ආරම්භ කරන්න',
                title_ta: 'புதிய உரையாடலைத் தொடங்கவும்',
                content_en: 'Click here to start a direct message thread with a teacher to discuss academic progress or inquiries.',
                content_si: 'දරුවාගේ අධ්‍යාපනික ප්‍රගතිය පිළිබඳව විමසීමට ගුරුවරයෙකු සමග නව පණිවිඩයක් ආරම්භ කරන්න.',
                content_ta: 'ஆசிரியருடன் புதிய நேரடி உரையாடலைத் தொடங்க இங்கே கிளிக் செய்யவும்.',
            },
            {
                target_element: '#chat-message-input',
                title_en: 'Send Direct Message',
                title_si: 'පණිවිඩයක් යවන්න',
                title_ta: 'செய்தி அனுப்பவும்',
                content_en: 'Type questions, attendance notifications, or feedback directly into the secure chat thread.',
                content_si: 'ඔබගේ ගැටළු, පැමිණීමේ දැනුම්දීම් හෝ විමසීම් ආරක්ෂිතව ගුරුවරයා වෙත යවන්න.',
                content_ta: 'உங்கள் கேள்விகள் அல்லது தகவல்களை நேரடியாக தட்டச்சு செய்து அனுப்பவும்.',
            },
        ],
    },
    'GENERAL:chat_main': {
        id: 'builtin_general_chat',
        steps: [
            {
                target_element: '#chat-conversation-list',
                title_en: 'Conversations Directory',
                title_si: 'පණිවිඩ නාමාවලිය',
                title_ta: 'உரையாடல் பட்டியல்',
                content_en: 'Browse your active school communications and group announcement channels.',
                content_si: 'ඔබගේ පණිවිඩ සහ නිවේදන නාලිකා මෙතැනින් බලන්න.',
                content_ta: 'உங்கள் உரையாடல்கள் மற்றும் அறிவிப்புகளை இங்கே காணலாம்.',
            },
            {
                target_element: '#chat-new-conversation',
                title_en: 'New Message',
                title_si: 'නව පණිවිඩයක්',
                title_ta: 'புதிய செய்தி',
                content_en: 'Start a direct or group conversation with teachers, staff, or guardians.',
                content_si: 'නව පණිවිඩයක් ආරම්භ කිරීමට මෙතැන ක්ලික් කරන්න.',
                content_ta: 'புதிய செய்தியைத் தொடங்க இங்கே கிளிக் செய்யவும்.',
            },
            {
                target_element: '#chat-message-input',
                title_en: 'Type Message',
                title_si: 'පණිවිඩය සටහන් කරන්න',
                title_ta: 'செய்தியை உள்ளிடவும்',
                content_en: 'Send real-time updates and questions securely.',
                content_si: 'පණිවිඩය සටහන් කර යවන්න.',
                content_ta: 'செய்தியைத் தட்டச்சு செய்து அனுப்பவும்.',
            },
        ],
    },
};

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
                // 1. Fetch tutorial data from server, falling back to built-in guided tours
                let tutData: any = null;
                try {
                    tutData = await apiClient.get(`/tutorials/${role}/${screenId}`, { token });
                } catch {
                    // Fall back to client-side built-in definitions
                }

                if (!tutData || !tutData.id || !Array.isArray(tutData.steps) || tutData.steps.length === 0) {
                    tutData = BUILTIN_TOURS[`${role}:${screenId}`] || BUILTIN_TOURS[`GENERAL:${screenId}`] || null;
                }

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
                let userId = typeof window !== 'undefined' ? authManager.getUserId() : null;
                if (!userId && token) {
                    try {
                        const parts = token.split('.');
                        if (parts.length === 3) {
                            const payload = JSON.parse(atob(parts[1]));
                            userId = payload.sub || payload.userId || payload.id || null;
                        }
                    } catch { }
                }
                userId = userId || 'anonymous';
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
                    markCompleteOrSkip(status, tutData.id, tenantId || '', token);
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

                // 2. Suppress the tour for anyone who has already completed or dismissed it.
                // Defers to the server per-user records so dismissal follows the user across devices/browsers.
                let alreadySeen = readLocal() !== null || isDismissed();
                if (!alreadySeen && token) {
                    try {
                        const completionsRes: any = await apiClient.get('/me/tutorials', { token, tenantId: tenantId || '' });
                        const compList: any[] = Array.isArray(completionsRes)
                            ? completionsRes
                            : (completionsRes?.data && Array.isArray(completionsRes.data) ? completionsRes.data : []);
                        alreadySeen = compList.some(
                            (c: any) =>
                                (c.tutorial_id === tutData.id || c.tutorialId === tutData.id) &&
                                (c.status === 'COMPLETED' || c.status === 'SKIPPED'),
                        );
                    } catch {
                        // ignore API failure and rely on local storage
                    }
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
