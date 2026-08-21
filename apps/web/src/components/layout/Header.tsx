'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Info, Menu, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

import { usePathname, useRouter } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { authManager } from '@/lib/auth-store';
import { cn } from '@/lib/cn';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useSidebar } from './SidebarContext';

interface Notification {
    title?: string;
    message?: string;
    type?: string;
    timestamp?: string | number;
}

/** Search landing page per role. `userRole` is the space-separated display form. */
const SEARCH_TARGET: Record<string, string> = {
    'SUPER ADMIN': '/system-admin/users',
    'SCHOOL ADMIN': '/institution-admin/students',
    TEACHER: '/teacher/classes',
    STUDENT: '/student/grades',
    PARENT: '/parent',
};

const NOTIF_TONE: Record<string, string> = {
    warning: 'bg-warning-subtle text-warning',
    info: 'bg-info-subtle text-info',
    danger: 'bg-destructive-subtle text-destructive',
};

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const t = useTranslations('Header');
    const tc = useTranslations('Common');
    const { setIsOpen } = useSidebar();

    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Notifications
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const notifRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const role = authManager.getRole() || 'USER';
            setUserRole(role.replace('_', ' '));

            try {
                // Both /users/me and /parents/me work, but only with the right headers —
                // apiClient attaches X-Tenant-Id and the auth cookie for us.
                const uri = role === 'PARENT' ? '/parents/me' : '/users/me';
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

        // ---------------- Realtime notifications ----------------
        const notificationMethod =
            process.env.NEXT_PUBLIC_NOTIFICATION_METHOD || 'socket.io';
        let cleanupFn = () => { };

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

        // Vercel serverless breaks Socket.io long-polling (400s), so fall back to
        // Supabase Realtime there or when the env forces it.
        if (notificationMethod === 'supabase' || apiUrl.includes('vercel.app')) {
            try {
                const supabase = createSupabaseBrowserClient();
                const channel = supabase
                    .channel('system_notifications')
                    .on('broadcast', { event: 'system_notification' }, (payload) => {
                        // Supabase wraps broadcast data in `payload.payload`.
                        if (payload?.payload) {
                            setNotifications((prev) => [payload.payload, ...prev]);
                            toast.info(payload.payload.title || t('notifications'), {
                                description: payload.payload.message,
                                duration: 5000,
                            });
                        }
                    })
                    .subscribe();

                cleanupFn = () => {
                    supabase.removeChannel(channel);
                };
            } catch (error) {
                console.error('[Notifications] Failed to init Supabase client', error);
            }
        } else {
            const socket = io(apiUrl, {
                transports: ['polling', 'websocket'],
                autoConnect: true,
            });

            socket.on('system_notification', (data: Notification) => {
                setNotifications((prev) => [data, ...prev]);
                toast.info(data.title || t('notifications'), {
                    description: data.message,
                    duration: 5000,
                });
            });

            socketRef.current = socket;
            cleanupFn = () => {
                socket.disconnect();
            };
        }

        return cleanupFn;
    }, [t]);

    // Close the notification dropdown on outside click / Escape.
    useEffect(() => {
        if (!showNotifications) return;

        const onPointerDown = (event: MouseEvent) => {
            if (!notifRef.current?.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShowNotifications(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [showNotifications]);

    const getPageTitle = () => {
        if (pathname?.includes('/grades')) return t('gradesReports');
        if (pathname?.includes('/classes')) return t('classMgmt');
        if (pathname?.includes('/users')) return t('userDirectory');
        if (pathname?.includes('/policy')) return t('schoolPolicies');
        return t('overviewDashboard');
    };

    /** Single source of truth for search navigation, shared by debounce + Enter. */
    const runSearch = useCallback(
        (query: string) => {
            const base = SEARCH_TARGET[userRole];
            if (!base) return;

            const trimmed = query.trim();
            if (trimmed) {
                router.push(`${base}?query=${encodeURIComponent(trimmed)}`);
            } else if (query === '') {
                // Clearing the box returns to the unfiltered list.
                router.push(base);
            }
        },
        [router, userRole],
    );

    // Debounce the search query.
    useEffect(() => {
        if (!isTyping) return;
        const timer = setTimeout(() => {
            runSearch(searchQuery);
            setIsTyping(false);
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery, isTyping, runSearch]);

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setIsTyping(false); // Skip the debounce.
            if (searchQuery.trim()) runSearch(searchQuery);
        }
    };

    return (
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-md sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    aria-label={tc('openMenu')}
                    className="-ml-1 rounded-input p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
                >
                    <Menu className="size-5" />
                </button>

                <motion.h1
                    key={getPageTitle()}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="truncate text-[15px] font-semibold tracking-tight text-foreground sm:text-base"
                >
                    {getPageTitle()}
                </motion.h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Search — only rendered for roles that have a search target. */}
                {SEARCH_TARGET[userRole] && (
                    <div className="relative hidden lg:block">
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setIsTyping(true);
                            }}
                            onKeyDown={handleSearchKeyDown}
                            placeholder={t('searchPlaceholder')}
                            aria-label={tc('search')}
                            className="h-9 w-60 rounded-pill border border-transparent bg-muted pl-9 pr-4 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-input focus:bg-card focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring xl:w-72"
                        />
                    </div>
                )}

                <ThemeToggle variant="icon" />

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                    <button
                        type="button"
                        onClick={() => setShowNotifications((prev) => !prev)}
                        aria-label={t('notifications')}
                        aria-expanded={showNotifications}
                        aria-haspopup="menu"
                        className={cn(
                            'relative grid size-9 place-items-center rounded-input transition-colors',
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                            showNotifications
                                ? 'bg-accent text-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                    >
                        <Bell className="size-[18px]" />
                        {notifications.length > 0 && (
                            <span className="absolute right-1.5 top-1.5 size-2.5 animate-pulse rounded-full border-2 border-card bg-destructive" />
                        )}
                    </button>

                    {showNotifications && (
                        <div
                            role="menu"
                            className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-slide-up overflow-hidden rounded-card border border-border bg-popover text-popover-foreground shadow-dropdown"
                        >
                            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/60 px-4 py-3">
                                <h3 className="text-sm font-semibold tracking-tight">
                                    {t('notifications')}
                                </h3>
                                <Badge tone="primary" variant="soft">
                                    {notifications.length}
                                </Badge>
                            </div>

                            <div className="max-h-80 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 px-6 py-9 text-center">
                                        <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                                            <Bell className="size-[18px]" />
                                        </span>
                                        <p className="text-sm text-muted-foreground">
                                            {t('noNotifications')}
                                        </p>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-border">
                                        {notifications.map((notif, idx) => {
                                            const Icon =
                                                notif.type === 'warning'
                                                    ? AlertTriangle
                                                    : notif.type === 'info'
                                                        ? Info
                                                        : Bell;
                                            return (
                                                <li
                                                    key={`${notif.timestamp ?? ''}-${idx}`}
                                                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent"
                                                >
                                                    <span
                                                        className={cn(
                                                            'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
                                                            NOTIF_TONE[notif.type ?? ''] ??
                                                            'bg-muted text-muted-foreground',
                                                        )}
                                                    >
                                                        <Icon className="size-4" />
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="truncate text-sm font-semibold text-foreground">
                                                            {notif.title}
                                                        </h4>
                                                        {notif.message && (
                                                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                                                {notif.message}
                                                            </p>
                                                        )}
                                                        {notif.timestamp && (
                                                            <time className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                                                                {new Date(
                                                                    notif.timestamp,
                                                                ).toLocaleTimeString()}
                                                            </time>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

                {/* Identity */}
                <div className="flex items-center gap-2.5 rounded-pill border border-transparent p-1 pr-1 transition-colors hover:border-border hover:bg-accent sm:pr-3">
                    <Avatar name={userName} size="sm" />
                    <div className="hidden min-w-0 sm:block">
                        <p className="truncate text-[13px] font-semibold capitalize leading-tight text-foreground">
                            {userName || '—'}
                        </p>
                        <p className="truncate text-[11px] capitalize leading-tight text-muted-foreground">
                            {userRole.toLowerCase()}
                        </p>
                    </div>
                </div>
            </div>
        </header>
    );
}
