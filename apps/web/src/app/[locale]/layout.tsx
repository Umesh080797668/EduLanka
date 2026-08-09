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
