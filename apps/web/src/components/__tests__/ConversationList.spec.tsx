import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConversationList from '../chat/ConversationList';
import { apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
    apiClient: {
        get: jest.fn(),
        patch: jest.fn(),
    },
}));

jest.mock('@/lib/auth-store', () => ({
    authManager: {
        getUserId: jest.fn(() => 'user-me'),
    },
}));

jest.mock('next-intl', () => ({
    useTranslations: jest.fn(() => (key: string) => {
        const dict: Record<string, string> = {
            noConversations: 'No conversations yet',
            loadFailed: 'Failed to load conversations',
            groupChat: 'Group Chat',
            directMessage: 'Direct Message',
            untitled: 'Untitled',
            you: 'You',
        };
        return dict[key] || key;
    }),
}));

describe('ConversationList Component', () => {
    const mockOnSelect = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders empty state when there are no conversations', async () => {
        (apiClient.get as jest.Mock).mockResolvedValueOnce([]);

        render(<ConversationList selectedId={null} onSelect={mockOnSelect} />);

        await waitFor(() => {
            expect(screen.getByText('No conversations yet')).toBeInTheDocument();
        });
    });

    it('renders conversations with titles and handles selection', async () => {
        const mockConversations = [
            {
                id: 'conv-1',
                name: 'Mr. Silva (Math)',
                type: 'DIRECT',
                last_message: { sender_id: 'user-2', content: 'Please review homework', created_at: new Date().toISOString() },
                unread_count: 2,
                is_muted: false,
                class_id: null,
                muted_until: null,
                created_at: new Date().toISOString(),
            },
            {
                id: 'conv-2',
                name: 'Grade 10 Science Teachers',
                type: 'GROUP',
                last_message: { sender_id: 'user-3', content: 'Meeting tomorrow at 9 AM', created_at: new Date().toISOString() },
                unread_count: 0,
                is_muted: false,
                class_id: null,
                muted_until: null,
                created_at: new Date().toISOString(),
            },
        ];

        (apiClient.get as jest.Mock).mockResolvedValueOnce(mockConversations);

        render(<ConversationList selectedId={null} onSelect={mockOnSelect} />);

        await waitFor(() => {
            expect(screen.getByText('Mr. Silva (Math)')).toBeInTheDocument();
            expect(screen.getByText('Grade 10 Science Teachers')).toBeInTheDocument();
            expect(screen.getByText('Please review homework')).toBeInTheDocument();
        });

        const convItem = screen.getByText('Mr. Silva (Math)');
        fireEvent.click(convItem);

        expect(mockOnSelect).toHaveBeenCalledWith(mockConversations[0]);
    });
});
