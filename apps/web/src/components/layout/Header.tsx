'use client';
import { authManager } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';

import { Bell, Search, User, Menu } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/routing';
import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSidebar } from './SidebarContext';
import { io, Socket } from 'socket.io-client';

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const t = useTranslations('Header');
    const [userName, setUserName] = useState('...');
    const [userRole, setUserRole] = useState('...');
    const { setIsOpen } = useSidebar();
    const [searchQuery, setSearchQuery] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Notifications State
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const fetchUser = async () => {

            const role = authManager.getRole() || 'USER';
            setUserRole(role.replace('_', ' '));

            try {
                // Fetch the dynamic user based on API (for simplicity, using generic me endpoint we added)
                // Both /users/me and /parents/me work, but only if they have the right headers
                const uri = role === 'PARENT' ? '/parents/me' : '/users/me';

                // Use apiClient so that the authManager seamlessly attaches the X-Tenant-Id header
                const data = await apiClient.get<any>(uri);

                if (role === 'PARENT') {
                    setUserName(data?.users?.full_name || t('parentUser'));
                } else {
                    setUserName(data?.full_name || t('user'));
                }
            } catch (e) {
                console.error(e);
                setUserName(t('sessionActive'));
            }
        };
        fetchUser();

        // ---------------- Socket.io Connection ----------------
        // Hybrid Strategy: Starts with Polling, upgrades to WebSocket
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

        // Vercel serverless completely breaks Socket.io long-polling states resulting in 400s.
        // Disable real-time sockets if deployed to Vercel to preserve UX.
        if (apiUrl.includes('vercel.app')) {
            console.log('[Notifications] Socket.io is disabled on Vercel Serverless deployments.');
            return;
        }

        const socket = io(apiUrl, {
            transports: ['polling', 'websocket'],
            autoConnect: true,
        });

        socket.on('connect', () => {
            console.log(`[Notifications] Connected with ID: ${socket.id} via ${socket.io.engine.transport.name}`);

            // Optionally monitor transport upgrades from polling to websocket
            socket.io.engine.on('upgrade', (transport) => {
                console.log('[Notifications] Transport upgraded to', transport.name);
            });
        });

        socket.on('system_notification', (data) => {
            setNotifications(prev => [data, ...prev]);
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [t]);

    // Determine title based on path
    const getPageTitle = () => {
        if (pathname?.includes('/grades')) return t('gradesReports');
        if (pathname?.includes('/classes')) return t('classMgmt');
        if (pathname?.includes('/users')) return t('userDirectory');
        if (pathname?.includes('/policy')) return t('schoolPolicies');
        return t('overviewDashboard');
    };

    // Debounce the search query
    useEffect(() => {
        if (!isTyping) return;
        const timer = setTimeout(() => {
            if (searchQuery.trim()) {
                const queryUri = encodeURIComponent(searchQuery.trim());
                if (userRole === 'SUPER ADMIN') {
                    router.push(`/system-admin/users?query=${queryUri}`);
                } else if (userRole === 'SCHOOL ADMIN') {
                    router.push(`/institution-admin/students?query=${queryUri}`);
                } else if (userRole === 'TEACHER') {
                    router.push(`/teacher/classes?query=${queryUri}`);
                }
            } else if (searchQuery === '') {
                // If they clear the search, push back to base dir
                if (userRole === 'SUPER ADMIN') router.push(`/system-admin/users`);
                if (userRole === 'SCHOOL ADMIN') router.push(`/institution-admin/students`);
                if (userRole === 'TEACHER') router.push(`/teacher/classes`);
            }
            setIsTyping(false);
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery, isTyping, router, userRole]);

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setIsTyping(false); // Force rapid push
            if (searchQuery.trim()) {
                const queryUri = encodeURIComponent(searchQuery.trim());
                if (userRole === 'SUPER ADMIN') {
                    router.push(`/system-admin/users?query=${queryUri}`);
                } else if (userRole === 'SCHOOL ADMIN') {
                    router.push(`/institution-admin/students?query=${queryUri}`);
                } else if (userRole === 'TEACHER') {
                    router.push(`/teacher/classes?query=${queryUri}`);
                }
            }
        }
    };

    return (
        <header className="h-16 flex items-center justify-between px-6 bg-white/70 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setIsOpen(true)}
                    className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <Menu className="w-5 h-5" />
                </button>
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
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsTyping(true);
                        }}
                        onKeyDown={handleSearch}
                        placeholder={t('searchPlaceholder')}
                        className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all w-64"
                    />
                </div>

                <div className="relative">
                    <button
                        className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        <Bell className="w-5 h-5" />
                        {notifications.length > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
                        )}
                    </button>

                    {/* Notifications Dropdown */}
                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="font-semibold text-slate-800 text-sm">{t('notifications') || 'Notifications'}</h3>
                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                    {notifications.length}
                                </span>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 text-sm">
                                        No new notifications.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {notifications.map((notif, idx) => (
                                            <div key={idx} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-3">
                                                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center
                                                    ${notif.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                                        notif.type === 'info' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                                                    <Bell className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-semibold text-slate-800">{notif.title}</h4>
                                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                                        {new Date(notif.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

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
