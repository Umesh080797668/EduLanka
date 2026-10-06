import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InquiriesBoard } from '../inquiries/InquiriesBoard';
import { fetchInquiries, updateInquiryStatus } from '@/lib/api/school';

jest.mock('@/lib/api/school', () => ({
    fetchInquiries: jest.fn(),
    updateInquiryStatus: jest.fn(),
}));

jest.mock('@/lib/auth-store', () => ({
    authManager: {
        getToken: jest.fn(() => 'mock-jwt-token'),
        getTenantId: jest.fn(() => 'mock-tenant-id'),
        getUserId: jest.fn(() => 'mock-user-id'),
    },
}));

jest.mock('next-intl', () => ({
    useTranslations: jest.fn(() => (key: string) => {
        const dictionary: Record<string, string> = {
            title: 'Deactivation Inquiries',
            description: 'Review appeals from deactivated accounts',
            empty: 'No Inquiries Pending',
            emptySubtitle: 'All appeals have been reviewed.',
            colUser: 'User',
            colRole: 'Role',
            colMessage: 'Reason / Appeal',
            colStatus: 'Status',
            colActions: 'Actions',
            resolve: 'Resolve',
            reject: 'Reject',
            statusPending: 'Pending',
            statusResolved: 'Resolved',
            statusRejected: 'Rejected',
        };
        return dictionary[key] || key;
    }),
}));

describe('InquiriesBoard Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders empty state when there are no inquiries', async () => {
        (fetchInquiries as jest.Mock).mockResolvedValueOnce([]);

        render(<InquiriesBoard />);

        await waitFor(() => {
            expect(screen.getByText('No Inquiries Pending')).toBeInTheDocument();
        });
    });

    it('renders list of inquiries with user details and appeal message', async () => {
        const mockData = [
            {
                id: 'inq-1',
                role: 'TEACHER',
                message: 'Account was accidentally disabled during term transition.',
                status: 'PENDING',
                created_at: new Date().toISOString(),
                users: {
                    full_name: 'Sunil Perera',
                    email: 'sunil@royal.lk',
                },
                tenants: {
                    name: 'Royal College',
                },
            },
        ];

        (fetchInquiries as jest.Mock).mockResolvedValueOnce(mockData);

        render(<InquiriesBoard />);

        await waitFor(() => {
            expect(screen.getByText('Sunil Perera')).toBeInTheDocument();
            expect(screen.getByText('sunil@royal.lk')).toBeInTheDocument();
            expect(screen.getByText('Account was accidentally disabled during term transition.')).toBeInTheDocument();
        });
    });

    it('handles resolving an inquiry status', async () => {
        const mockData = [
            {
                id: 'inq-2',
                role: 'STUDENT',
                message: 'Please re-activate my student portal access.',
                status: 'PENDING',
                created_at: new Date().toISOString(),
                users: {
                    full_name: 'Kamal Bandara',
                    email: 'kamal@royal.lk',
                },
            },
        ];

        (fetchInquiries as jest.Mock).mockResolvedValueOnce(mockData);
        (updateInquiryStatus as jest.Mock).mockResolvedValueOnce({ success: true });

        render(<InquiriesBoard />);

        await waitFor(() => {
            expect(screen.getByText('Kamal Bandara')).toBeInTheDocument();
        });

        const resolveButton = screen.getByTitle('Resolve');
        fireEvent.click(resolveButton);

        await waitFor(() => {
            expect(updateInquiryStatus).toHaveBeenCalledWith(
                'inq-2',
                'RESOLVED',
                expect.objectContaining({ token: 'mock-jwt-token' })
            );
        });
    });
});
