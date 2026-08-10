import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpButton } from '../HelpButton';
import { useTutorial } from '../TutorialProvider';
import { useTranslations } from 'next-intl';

// Mock dependencies
jest.mock('../TutorialProvider', () => ({
    useTutorial: jest.fn(),
}));

jest.mock('next-intl', () => ({
    useTranslations: jest.fn(),
}));

describe('HelpButton', () => {
    let mockStartTutorial: jest.Mock;
    let mockTranslate: jest.Mock;

    beforeEach(() => {
        mockStartTutorial = jest.fn();
        (useTutorial as jest.Mock).mockReturnValue({
            startTutorial: mockStartTutorial,
        });

        mockTranslate = jest.fn((key: string) => key === 'help' ? 'Help Tour' : key);
        (useTranslations as jest.Mock).mockReturnValue(mockTranslate);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render the help button with correct aria-labels', () => {
        render(<HelpButton />);
        const button = screen.getByRole('button', { name: 'Help Tour' });
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('title', 'Help Tour');
    });

    it('should call startTutorial when clicked', () => {
        render(<HelpButton />);
        const button = screen.getByRole('button', { name: 'Help Tour' });
        fireEvent.click(button);
        expect(mockStartTutorial).toHaveBeenCalledTimes(1);
    });
});
