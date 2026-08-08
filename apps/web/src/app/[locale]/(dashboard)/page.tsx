'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
    const router = useRouter();

    useEffect(() => {
        const role = localStorage.getItem('role');
        if (!role) {
            // Missing role but active token edge-case
            localStorage.clear();
            router.replace('/login');
            return;
        }

        // Route directly to their portal 
        router.replace(`/${role.toLowerCase()}`);
    }, [router]);

    return (
        <div className="flex h-[80vh] items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="font-medium animate-pulse">Resolving dashboard access...</p>
            </div>
        </div>
    );
}
