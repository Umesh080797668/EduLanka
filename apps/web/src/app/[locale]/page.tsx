'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        // Read auth state
                if (token) {
            router.replace('/dashboard');
        } else {
            router.replace('/login');
        }
    }, [router]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
    );
}
