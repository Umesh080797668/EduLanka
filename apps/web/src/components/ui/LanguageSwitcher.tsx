'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { Globe } from 'lucide-react';

const LOCALES = [
    { code: 'en', label: 'EN', title: 'English' },
    { code: 'si', label: 'සි', title: 'Sinhala' },
    { code: 'ta', label: 'த', title: 'Tamil' },
];

export function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    const handleChange = (newLocale: string) => {
        router.replace(pathname, { locale: newLocale });
    };

    return (
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-1" />
            {LOCALES.map((loc) => (
                <button
                    key={loc.code}
                    title={loc.title}
                    onClick={() => handleChange(loc.code)}
                    className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${locale === loc.code
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                >
                    {loc.label}
                </button>
            ))}
        </div>
    );
}
