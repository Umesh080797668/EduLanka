import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';

export const metadata: Metadata = {
    title: 'Page Not Found',
};

export default function NotFoundPage() {
    const t = useTranslations('NotFound');
    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-sans)',
            }}
        >
            <div style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '4rem', fontWeight: 800, color: 'var(--color-brand-500)', marginBottom: '0.5rem' }}>
                    404
                </h1>
                <p style={{ color: 'oklch(0.45 0 0)', marginBottom: '1.5rem' }}>
                    {t('description')}
                </p>
                <a
                    href="/en"
                    style={{
                        color: 'var(--color-brand-500)',
                        textDecoration: 'underline',
                        fontWeight: 500,
                        fontSize: '0.9rem',
                    }}
                >
                    {t('returnHome')}
                </a>
            </div>
        </div>
    );
}
