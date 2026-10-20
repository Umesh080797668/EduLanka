import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TutorialProvider, useTutorial } from '../TutorialProvider';
import { apiClient } from '../../lib/api-client';
import { driver } from 'driver.js';

jest.mock('@/lib/auth-store', () => ({
    authManager: {
        getToken: jest.fn(() => 'mock-jwt-token'),
        getTenantId: jest.fn(() => 'mock-tenant-id'),
        getUserId: jest.fn(() => 'user-123'),
        getPlan: jest.fn(() => 'COMMUNITY'),
    },
}));

jest.mock('../../lib/api-client', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockDrive = jest.fn();
const mockDestroy = jest.fn();
jest.mock('driver.js', () => ({
    driver: jest.fn(() => ({
        drive: mockDrive,
        destroy: mockDestroy,
        getActiveIndex: jest.fn(() => 0),
    })),
}));

jest.mock('next-intl', () => ({
    useLocale: jest.fn(() => 'en'),
    useTranslations: jest.fn(() => (key: string) => key),
}));

function ConsumerComponent() {
    const { startTutorial, currentScreenId } = useTutorial();
    return (
        <div>
            <span data-testid="screen-id">{currentScreenId}</span>
            <button onClick={startTutorial}>Trigger</button>
        </div>
    );
}

describe('TutorialProvider Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
    });

    it('renders children and provides currentScreenId', async () => {
        (apiClient.get as jest.Mock).mockResolvedValueOnce({
            id: 'tut-1',
            steps: [],
        });

        render(
            <TutorialProvider role="STUDENT" screenId="student_homework">
                <ConsumerComponent />
            </TutorialProvider>,
        );

        expect(screen.getByTestId('screen-id')).toHaveTextContent('student_homework');
    });

    it('loads tutorial steps and configures driver', async () => {
        (apiClient.get as jest.Mock).mockImplementation((path: string) => {
            if (path.includes('/tutorials/STUDENT/student_homework')) {
                return Promise.resolve({
                    id: 'tut-1',
                    steps: [
                        {
                            target_element: '#step-1',
                            title_en: 'Step 1',
                            content_en: 'Description 1',
                        },
                    ],
                });
            }
            if (path.includes('/me/tutorials')) {
                return Promise.resolve([]);
            }
            return Promise.resolve(null);
        });

        render(
            <TutorialProvider role="STUDENT" screenId="student_homework">
                <ConsumerComponent />
            </TutorialProvider>,
        );

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith(
                '/tutorials/STUDENT/student_homework',
                expect.objectContaining({ token: 'mock-jwt-token' }),
            );
        });

        expect(driver).toHaveBeenCalledWith(
            expect.objectContaining({
                showProgress: true,
                allowClose: true,
            }),
        );
    });

    it('suppresses tour if dismissed in localStorage for the user', async () => {
        window.localStorage.setItem('edulanka:tour:dismiss:user-123:student_homework', 'true');

        (apiClient.get as jest.Mock).mockResolvedValueOnce({
            id: 'tut-1',
            steps: [
                {
                    target_element: '#step-1',
                    title_en: 'Step 1',
                    content_en: 'Description 1',
                },
            ],
        });

        render(
            <TutorialProvider role="STUDENT" screenId="student_homework">
                <ConsumerComponent />
            </TutorialProvider>,
        );

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith(
                '/tutorials/STUDENT/student_homework',
                expect.anything(),
            );
        });

        // /me/tutorials should not even be queried because it is already dismissed locally
        expect(apiClient.get).not.toHaveBeenCalledWith(
            '/me/tutorials',
            expect.anything(),
        );
    });

    it('handles 404 or unseeded tutorials gracefully without throwing', async () => {
        (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('No active tutorial found for this screen'));

        expect(() => {
            render(
                <TutorialProvider role="STUDENT" screenId="unseeded_screen">
                    <ConsumerComponent />
                </TutorialProvider>,
            );
        }).not.toThrow();

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith(
                '/tutorials/STUDENT/unseeded_screen',
                expect.anything(),
            );
        });
    });
});
