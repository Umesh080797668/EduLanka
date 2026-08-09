import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
    // Turbopack is enabled via the --turbopack CLI flag in dev
    // For build: enabled by default in Next.js 15+

    // Treat TypeScript errors as errors during build.
    // Note: Next.js 16 removed the built-in `eslint` config option (and `next lint`);
    // ESLint now runs standalone via `pnpm run lint` / the CI pipeline instead of during `next build`.
    typescript: {
        ignoreBuildErrors: false,
    },

    // Output standalone bundle for optimized Docker deployments
    // output: 'standalone',

    // Proxy API requests to backend API server
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${process.env.API_URL || 'http://localhost:8081/api'}/:path*`, // Proxy to backend
            },
        ];
    },

    // Allow images from Supabase Storage and Cloudinary CDN
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '*.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
            },
        ],
    },

    // Strict security headers
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                ],
            },
        ];
    },
};

export default withNextIntl(nextConfig);
