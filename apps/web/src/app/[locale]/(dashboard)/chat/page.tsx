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
  const [tenantId, setTenantId] = useState(() =>
    typeof window !== 'undefined' ? authManager.getTenantId() || '' : ''
  );

  useEffect(() => {
    const updateAuth = () => {
      const currentRole = authManager.getRole();
      if (currentRole) {
        setRole(currentRole);
      }
      setTenantId(authManager.getTenantId() || '');
    };

    updateAuth();

    const handleTenantChange = () => {
      updateAuth();
    };

    window.addEventListener('edulanka:tenant-changed', handleTenantChange);
    window.addEventListener('storage', handleTenantChange);

    return () => {
      window.removeEventListener('edulanka:tenant-changed', handleTenantChange);
      window.removeEventListener('storage', handleTenantChange);
    };
  }, []);

  return (
    <TutorialProvider role={role} screenId="chat_main">
      {/* The chat shell owns its own scrolling, so pin it to the viewport. Keyed by tenantId to tear down and re-authenticate socket on tenant switch. */}
      <div
        className="relative isolate flex h-[calc(100dvh-4rem)] min-h-0 flex-1 flex-col"
        aria-label={t('conversationThread')}
      >
        <ChatContainer key={tenantId} />
        <HelpButton />
      </div>
    </TutorialProvider>
  );
}
