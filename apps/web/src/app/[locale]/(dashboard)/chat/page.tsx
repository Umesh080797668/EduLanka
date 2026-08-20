import React from 'react';
import ChatContainer from '@/components/chat/ChatContainer';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';

export default function ChatPage() {
    return (
        <TutorialProvider role="GENERAL" screenId="chat_main">
            <div className="flex-1 flex flex-col h-full bg-background relative isolate max-h-[calc(100vh-64px)]">
                <ChatContainer />
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
