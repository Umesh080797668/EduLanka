'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import ChatContainer from '@/components/chat/ChatContainer';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';
import { authManager } from '@/lib/auth-store';

export default function ChatPage() {
    const t = useTranslations('Chat');
    const [role, setRole] = useState('GENERAL');

    useEffect(() => {
        const currentRole = authManager.getRole();
        if (currentRole) {
            setRole(currentRole);
        }
    }, []);

    return (
        <TutorialProvider role={role} screenId="chat_main">
            {/* The chat shell owns its own scrolling, so pin it to the viewport. */}
            <div className="relative isolate flex h-[calc(100dvh-4rem)] min-h-0 flex-1 flex-col" aria-label={t('conversationThread')}>
                <ChatContainer />
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}

