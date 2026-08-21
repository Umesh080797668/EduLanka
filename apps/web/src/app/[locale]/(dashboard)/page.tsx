'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Role → portal route. Not derivable by lowercasing the role: the admin portals
 * live at `/institution-admin` and `/system-admin`, not `/school_admin`
 * and `/super_admin`.
 */
const PORTAL_BY_ROLE: Record<string, string> = {
    STUDENT: '/student',
    PARENT: '/parent',
    TEACHER: '/teacher',
    SCHOOL_ADMIN: '/institution-admin',
    SUPER_ADMIN: '/system-admin',
};

export default function DashboardPage() {
    const router = useRouter();
    const t = useTranslations('Dashboard');

    useEffect(() => {
        const role = authManager.getRole()?.toUpperCase();
        const portal = role ? PORTAL_BY_ROLE[role] : undefined;

        if (!portal) {
            // Active session but no recognisable role — force a clean re-auth.
            authManager.clearAuth();
            router.replace('/login');
            return;
        }

        router.replace(portal);
    }, [router]);

    return (
        <div className="grid min-h-[60vh] place-items-center">
            <Spinner text={t('resolvingAccess')} />
        </div>
    );
}
