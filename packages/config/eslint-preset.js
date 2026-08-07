/** @type {import("eslint").Linter.Config} */
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
            jsx: true,
        },
    },
    plugins: ['@typescript-eslint', 'import'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'plugin:import/recommended',
        'plugin:import/typescript',
    ],
    settings: {
        'import/resolver': {
            typescript: {
                alwaysTryTypes: true,
                project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
            },
        },
    },
    rules: {
        // TypeScript
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
        '@typescript-eslint/consistent-type-exports': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/await-thenable': 'error',

        // Imports
        'import/order': [
            'error',
            {
                groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                'newlines-between': 'always',
                alphabetize: { order: 'asc', caseInsensitive: true },
            },
        ],
        'import/no-duplicates': 'error',
        'import/no-default-export': 'off',

        // General
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        eqeqeq: ['error', 'always'],
    },
    overrides: [
        // Next.js pages / layouts allow default exports
        {
            files: ['apps/web/src/app/**/*.tsx', 'apps/web/src/pages/**/*.tsx'],
            rules: {
                'import/no-default-export': 'off',
            },
        },
        // Test files are more permissive
        {
            files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.e2e-spec.ts'],
            rules: {
                '@typescript-eslint/no-explicit-any': 'off',
                '@typescript-eslint/no-floating-promises': 'off',
            },
        },
    ],
    ignorePatterns: ['dist/', 'node_modules/', '.next/', 'coverage/', '*.js'],
};
