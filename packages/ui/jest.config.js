module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    testMatch: ['**/__tests__/**/*.spec.ts', '**/__tests__/**/*.spec.tsx'],
    setupFilesAfterEnv: ['@testing-library/jest-dom'],
};
