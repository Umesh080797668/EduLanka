'use client';

import { Bell, Search, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export default function Header() {
    const pathname = usePathname();
    const t = useTranslations('Header');
    const [userName, setUserName] = useState('...');
    const [userRole, setUserRole] = useState('...');

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem('token');
            const tenantId = localStorage.getItem('tenantId') || 'a1b2c3d4-0000-0000-0000-000000000001';
            const role = localStorage.getItem('role') || 'USER';
            setUserRole(role.replace('_', ' '));

            try {
                // Fetch the dynamic user based on API (for simplicity, using generic me endpoint we added)
                // Both /users/me and /parents/me work, but only if they have the right headers
                const uri = role === 'PARENT' ? '/api/v1/parents/me' : '/api/v1/users/me';
                const res = await fetch(uri, {
                    headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-id': tenantId }
                });
                if (res.ok) {
                    const json = await res.json();

                    if (role === 'PARENT') {
                        setUserName(json.data?.users?.full_name || t('parentUser'));
                    } else {
                        setUserName(json.data?.full_name || t('user'));
                    }
                } else {
                    setUserName(t('sessionActive'));
                }
            } catch (e) {
                setUserName(t('sessionActive'));
            }
        };
        fetchUser();
    }, []);

    // Determine title based on path
    const getPageTitle = () => {
        if (pathname?.includes('/grades')) return t('gradesReports');
        if (pathname?.includes('/classes')) return t('classMgmt');
        if (pathname?.includes('/users')) return t('userDirectory');
        if (pathname?.includes('/policy')) return t('schoolPolicies');
        return t('overviewDashboard');
    };

    return (
        <header className="h-16 flex items-center justify-between px-6 bg-white/70 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
            <div className="flex items-center gap-4">
                <motion.h1
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-lg font-semibold text-slate-800"
                >
                    {getPageTitle()}
                </motion.h1>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative hidden md:block">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('searchPlaceholder')}
                        className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all w-64"
                    />
                </div>

                <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                </button>

                <div className="w-px h-6 bg-slate-200 mx-2"></div>

                <div className="flex items-center gap-3 cursor-pointer p-1 pr-3 rounded-full hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                        <User className="w-4 h-4" />
                    </div>
                    <div className="hidden sm:block text-sm">
                        <p className="font-medium text-slate-700 leading-none mb-1 capitalize">{userName}</p>
                        <p className="text-xs text-slate-500 leading-none capitalize">{userRole.toLowerCase()}</p>
                    </div>
                </div>
            </div>
        </header>
    );
}
