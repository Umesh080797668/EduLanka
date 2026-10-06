import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DisasterModeModal } from '../DisasterModeModal';

jest.mock('next-intl', () => ({
    useTranslations: jest.fn(() => (key: string) => {
        const dictionary: Record<string, string> = {
            title: 'Activate Disaster Mode',
            subtitle: 'Trigger emergency broadcast to all registered school contacts.',
            initiate: 'Initiate Emergency Broadcast',
            reasonLabel: 'Disaster Reason',
            languageLabel: 'Broadcast Language',
            confirmTitle: 'Confirm Emergency Broadcast',
            confirmBody: 'Are you sure you want to broadcast this emergency alert?',
            confirmYes: 'Yes, Broadcast Emergency Alert',
            langSi: 'Sinhala (සිංහල)',
            langTa: 'Tamil (தமிழ்)',
            langEn: 'English',
            flood: 'Flood conditions',
            cyclone: 'Cyclone alert',
        };
        return dictionary[key] || key;
    }),
}));

describe('DisasterModeModal Component', () => {
    const mockOnClose = jest.fn();
    const mockOnConfirm = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders modal dialog with form fields and preview when open', () => {
        render(
            <DisasterModeModal
                isOpen={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
                schoolName="Royal College"
            />
        );

        expect(screen.getByText('Activate Disaster Mode')).toBeInTheDocument();
        expect(screen.getByText(/Royal College/)).toBeInTheDocument();
        expect(screen.getByText('Initiate Emergency Broadcast')).toBeInTheDocument();
    });

    it('switches broadcast language and updates live SMS preview', () => {
        render(
            <DisasterModeModal
                isOpen={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
                schoolName="Royal College"
            />
        );

        const languageSelect = screen.getByLabelText(/Broadcast Language/i);
        fireEvent.change(languageSelect, { target: { value: 'SI' } });

        expect(screen.getByText(/හදිසි නිවේදනය/)).toBeInTheDocument();
    });

    it('opens confirm dialog and calls onConfirm when confirmed', async () => {
        render(
            <DisasterModeModal
                isOpen={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
                schoolName="Royal College"
            />
        );

        const initiateBtn = screen.getByText('Initiate Emergency Broadcast');
        fireEvent.click(initiateBtn);

        await waitFor(() => {
            expect(screen.getByText('Confirm Emergency Broadcast')).toBeInTheDocument();
        });

        const confirmBtn = screen.getByText('Yes, Broadcast Emergency Alert');
        fireEvent.click(confirmBtn);

        expect(mockOnConfirm).toHaveBeenCalledWith('FLOOD', '', 'EN');
    });
});
