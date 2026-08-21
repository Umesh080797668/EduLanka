import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Toaster } from 'sonner';

import { routing } from '@/i18n/routing';
import { THEME_INIT_SCRIPT } from '@/components/ui/ThemeToggle';
import '../globals.css';

export const metadata: Metadata = {
    title: {
        default: 'EduLanka',
        template: '%s | EduLanka',
    },
    description:
        'EduLanka — National-scale school management platform built for Sri Lanka. Grades 1–13, multi-tenant, teacher & parent portals.',
    metadataBase: new URL(
        process.env['NEXT_PUBLIC_APP_URL'] || 'https://edulanka.com',
    ),
    applicationName: 'EduLanka',
    openGraph: {
        siteName: 'EduLanka',
        type: 'website',
        locale: 'en_LK',
    },
    robots: { index: false, follow: false }, // set to true when public
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    // Matches --background in both themes so the browser chrome blends in.
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
        { media: '(prefers-color-scheme: dark)', color: '#0b0f19' },
    ],
};

export default async function RootLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) {
        notFound();
    }

    const messages = await getMessages();
    const t = await getTranslations({ locale, namespace: 'Common' });

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                {/* Applies the stored theme before first paint to avoid a flash. */}
                <script
                     
                    dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
                />
            </head>
            <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
                <a
                    href="#main-content"
                    className="sr-only rounded-input bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]"
                >
                    {t('skipToContent')}
                </a>

                <NextIntlClientProvider messages={messages}>
                    {children}
                    <Toaster
                        richColors
                        position="top-right"
                        expand
                        toastOptions={{
                            classNames: {
                                toast:
                                    'rounded-card border border-border bg-popover text-popover-foreground shadow-dropdown',
                                description: 'text-muted-foreground',
                            },
                        }}
                    />
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
