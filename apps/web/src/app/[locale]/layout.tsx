import type { Metadata } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';

import '../globals.css';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
});

const geistMono = Geist_Mono({
    subsets: ['latin'],
    variable: '--font-geist-mono',
    display: 'swap',
});

export const metadata: Metadata = {
    title: {
        default: 'EduLanka',
        template: '%s | EduLanka',
    },
    description:
        'EduLanka — National-scale school management platform built for Sri Lanka. Grades 1–13, multi-tenant, teacher & parent portals.',
    metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'),
    openGraph: {
        siteName: 'EduLanka',
        type: 'website',
        locale: 'en_LK',
    },
    robots: { index: false, follow: false }, // set to true when public
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
                {children}
            </body>
        </html>
    );
}
