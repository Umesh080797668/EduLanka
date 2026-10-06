import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NoticeFeed from '../notices/NoticeFeed';
import { apiClient } from '@/lib/api-client';
import { useTranslations } from 'next-intl';

jest.mock('@/lib/api-client', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

jest.mock('next-intl', () => ({
    useTranslations: jest.fn(),
}));

jest.mock('sonner', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
    },
}));

describe('NoticeFeed Component', () => {
    let mockTranslate: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockTranslate = jest.fn((key: string) => {
            const translations: Record<string, string> = {
                noNotices: 'No Notices Posted',
                emptyDescription: 'Check back later for announcements.',
                loadFailed: 'Failed to load notices',
                acknowledged: 'Acknowledged',
                acknowledge: 'Acknowledge Notice',
                requiresAck: 'Requires Acknowledgment',
                priority_URGENT: 'Urgent',
                priority_HIGH: 'High',
                priority_NORMAL: 'Normal',
                priority_LOW: 'Low',
                markAsRead: 'Mark as read',
                postedBy: 'Posted by',
                read: 'Read',
            };
            return translations[key] || key;
        });
        (useTranslations as jest.Mock).mockReturnValue(mockTranslate);
    });

    it('renders empty state when no notices are returned', async () => {
        (apiClient.get as jest.Mock).mockResolvedValueOnce([]);

        render(<NoticeFeed />);

        await waitFor(() => {
            expect(screen.getByText('No Notices Posted')).toBeInTheDocument();
        });
    });

    it('renders list of notices with priority badges and content', async () => {
        const mockNotices = [
            {
                id: 'notice-1',
                title: 'Emergency Weather Advisory',
                content_html: '<p>School will close early today.</p>',
                priority: 'URGENT',
                scope_type: 'ALL',
                created_at: new Date().toISOString(),
                author: { full_name: 'Principal Silva' },
                is_read: false,
                requires_acknowledgment: true,
                is_acknowledged: false,
            },
            {
                id: 'notice-2',
                title: 'Term Examination Schedule',
                content_html: '<p>Exams commence next Monday.</p>',
                priority: 'NORMAL',
                scope_type: 'STUDENTS',
                created_at: new Date().toISOString(),
                author: { full_name: 'Exam Unit' },
                is_read: true,
                requires_acknowledgment: false,
            },
        ];

        (apiClient.get as jest.Mock).mockResolvedValueOnce(mockNotices);

        render(<NoticeFeed />);

        await waitFor(() => {
            expect(screen.getByText('Emergency Weather Advisory')).toBeInTheDocument();
            expect(screen.getByText('Term Examination Schedule')).toBeInTheDocument();
        });

        expect(screen.getByText(/Principal Silva/)).toBeInTheDocument();
        expect(screen.getByText('Acknowledge Notice')).toBeInTheDocument();
    });

    it('handles acknowledgment click and updates acknowledgment state', async () => {
        const mockNotices = [
            {
                id: 'notice-10',
                title: 'Field Trip Permission Slip',
                content_html: '<p>Please confirm consent.</p>',
                priority: 'HIGH',
                scope_type: 'PARENTS',
                created_at: new Date().toISOString(),
                requires_acknowledgment: true,
                is_acknowledged: false,
            },
        ];

        (apiClient.get as jest.Mock).mockResolvedValueOnce(mockNotices);
        (apiClient.post as jest.Mock).mockResolvedValueOnce({ success: true });

        render(<NoticeFeed />);

        await waitFor(() => {
            expect(screen.getByText('Field Trip Permission Slip')).toBeInTheDocument();
        });

        const ackButton = screen.getByText('Acknowledge Notice');
        fireEvent.click(ackButton);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith(
                '/notices/notice-10/acknowledge',
                {},
                { skipGlobalToast: true }
            );
        });

        await waitFor(() => {
            expect(screen.getByText('Acknowledged')).toBeInTheDocument();
        });
    });
});
