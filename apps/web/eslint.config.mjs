// EduLanka — apps/web ESLint config (flat config, ESLint 9+)
//
// Next.js 16 removed the `next lint` command and shipped a flat-config-only
// version of eslint-config-next (peer dep: eslint >=9). The rest of the
// monorepo (apps/api) still uses the legacy .eslintrc-style shared preset
// in packages/config on ESLint 8, since NestJS/typescript-eslint v7 there
// aren't affected by the Next.js major bump. This file is web-only.

import nextConfig from 'eslint-config-next';
import tseslint from 'typescript-eslint';

export default [
    {
        ignores: ['.next/**', 'out/**', 'node_modules/**', 'coverage/**', '*.config.*'],
    },
    ...nextConfig,
    ...tseslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
        },
    },
];
