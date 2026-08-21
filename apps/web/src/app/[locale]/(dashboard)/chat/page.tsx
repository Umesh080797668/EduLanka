import ChatContainer from '@/components/chat/ChatContainer';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';

export default function ChatPage() {
    return (
        <TutorialProvider role="GENERAL" screenId="chat_main">
            {/* The chat shell owns its own scrolling, so pin it to the viewport. */}
            <div className="relative isolate flex h-[calc(100dvh-4rem)] min-h-0 flex-1 flex-col">
                <ChatContainer />
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
