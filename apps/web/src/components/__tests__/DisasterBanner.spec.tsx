import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DisasterBanner from '../DisasterBanner';
import { apiClient } from '@/lib/api-client';
import { useTranslations } from 'next-intl';

jest.mock('@/lib/api-client', () => ({
    apiClient: {
        get: jest.fn(),
    },
}));

jest.mock('next-intl', () => ({
    useTranslations: jest.fn(),
}));

describe('DisasterBanner', () => {
    let mockTranslate: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockTranslate = jest.fn((key: string) => {
            const translations: Record<string, string> = {
                disasterActiveTitle: 'School Emergency Notice Active',
                resumeLabel: 'Expected Resumption',
                tbd: 'To be announced',
                emergency: 'Emergency',
                flood: 'Flooding Conditions',
                cyclone: 'Cyclone Warning',
                whatSmsMeans: 'What does this SMS mean?',
                smsExplanationTitle: 'Understanding Disaster Mode SMS Alerts',
                smsExplanationBody: 'This school has activated emergency operations.',
            };
            return translations[key] || key;
        });
        (useTranslations as jest.Mock).mockReturnValue(mockTranslate);
    });

    it('renders nothing when disaster mode is false', async () => {
        (apiClient.get as jest.Mock).mockResolvedValueOnce({
            disasterMode: false,
            disasterReason: null,
            disasterResumeDate: null,
        });

        const { container } = render(<DisasterBanner />);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/tenants/stats', { skipGlobalToast: true });
        });

        expect(container.firstChild).toBeNull();
    });

    it('renders active disaster banner with localized reason when disaster mode is true', async () => {
        (apiClient.get as jest.Mock).mockResolvedValueOnce({
            disasterMode: true,
            disasterReason: 'FLOOD',
            disasterResumeDate: '2026-10-15',
        });

        render(<DisasterBanner />);

        await waitFor(() => {
            expect(screen.getByText('School Emergency Notice Active')).toBeInTheDocument();
        });

        expect(screen.getByText('Flooding Conditions')).toBeInTheDocument();
        expect(screen.getByText(/2026-10-15/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /What does this SMS mean\?/i })).toBeInTheDocument();
    });

    it('displays TBD fallback when disasterResumeDate is null', async () => {
        (apiClient.get as jest.Mock).mockResolvedValueOnce({
            disasterMode: true,
            disasterReason: 'CYCLONE',
            disasterResumeDate: null,
        });

        render(<DisasterBanner />);

        await waitFor(() => {
            expect(screen.getByText('Cyclone Warning')).toBeInTheDocument();
        });

        expect(screen.getByText(/To be announced/)).toBeInTheDocument();
    });

    it('opens and displays the SMS explanation dialog when clicked', async () => {
        (apiClient.get as jest.Mock).mockResolvedValueOnce({
            disasterMode: true,
            disasterReason: 'FLOOD',
            disasterResumeDate: null,
        });

        render(<DisasterBanner />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /What does this SMS mean\?/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /What does this SMS mean\?/i }));

        await waitFor(() => {
            expect(screen.getByText('Understanding Disaster Mode SMS Alerts')).toBeInTheDocument();
            expect(screen.getAllByText(/This school has activated emergency operations/i).length).toBeGreaterThan(0);
        });
    });
});
