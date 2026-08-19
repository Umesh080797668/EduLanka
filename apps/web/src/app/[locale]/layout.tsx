import type { Metadata } from 'next';
const inter = { variable: 'font-sans' };
const geistMono = { variable: 'font-mono' };
import '../globals.css';

export const metadata: Metadata = {
    title: {
        default: 'EduLanka',
        template: '%s | EduLanka',
    },
    description:
        'EduLanka — National-scale school management platform built for Sri Lanka. Grades 1–13, multi-tenant, teacher & parent portals.',
    metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] || 'https://edulanka.com'),
    openGraph: {
        siteName: 'EduLanka',
        type: 'website',
        locale: 'en_LK',
    },
    robots: { index: false, follow: false }, // set to true when public
};

import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Provide messages to the client
    const messages = await getMessages();
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
                <NextIntlClientProvider messages={messages}>
                    {children}
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
