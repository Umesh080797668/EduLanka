'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
    Baby,
    Bell,
    BookOpen,
    Building2,
    ChevronsLeft,
    GraduationCap,
    LayoutDashboard,
    LogOut,
    MessageSquare,
    MessagesSquare,
    PanelLeftOpen,
    Server,
    Settings,
    Shield,
    UserCheck,
    UserCog,
    Users,
    X,
} from 'lucide-react';

import { Link } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useSidebar } from './SidebarContext';

type Role = 'STUDENT' | 'PARENT' | 'TEACHER' | 'SCHOOL_ADMIN' | 'SUPER_ADMIN';

interface NavItem {
    nameKey: string;
    href: string;
    icon: React.ElementType;
    /** Marks the item as an exact match so it doesn't stay lit on child routes. */
    exact?: boolean;
}

interface NavSection {
    /** Omit to render the items without a section label. */
    titleKey?: string;
    items: NavItem[];
}

/**
 * Nav is grouped so long admin menus stay scannable. Order matters: the first
 * item of the first section is that role's landing page.
 */
const NAV: Record<Role, NavSection[]> = {
    STUDENT: [
        {
            items: [
                { nameKey: 'dashboard', href: '/student', icon: LayoutDashboard, exact: true },
                { nameKey: 'gradesReports', href: '/student/grades', icon: GraduationCap },
                { nameKey: 'chat', href: '/chat', icon: MessagesSquare },
            ],
        },
    ],
    PARENT: [
        {
            items: [
                { nameKey: 'dashboard', href: '/parent', icon: LayoutDashboard, exact: true },
                { nameKey: 'chat', href: '/chat', icon: MessagesSquare },
            ],
        },
    ],
    TEACHER: [
        {
            items: [
                { nameKey: 'dashboard', href: '/teacher', icon: LayoutDashboard, exact: true },
                { nameKey: 'classesGrades', href: '/teacher/classes', icon: BookOpen },
                { nameKey: 'chat', href: '/chat', icon: MessagesSquare },
            ],
        },
    ],
    SCHOOL_ADMIN: [
        {
            titleKey: 'sectionOverview',
            items: [
                {
                    nameKey: 'dashboard',
                    href: '/institution-admin',
                    icon: LayoutDashboard,
                    exact: true,
                },
            ],
        },
        {
            titleKey: 'sectionPeople',
            items: [
                { nameKey: 'students', href: '/institution-admin/students', icon: Baby },
                { nameKey: 'teachers', href: '/institution-admin/teachers', icon: UserCog },
                { nameKey: 'parents', href: '/institution-admin/parents', icon: UserCheck },
            ],
        },
        {
            titleKey: 'sectionAcademics',
            items: [
                { nameKey: 'classes', href: '/institution-admin/classes', icon: BookOpen },
                {
                    nameKey: 'grades',
                    href: '/institution-admin/grades',
                    icon: GraduationCap,
                },
            ],
        },
        {
            titleKey: 'sectionCommunication',
            items: [
                { nameKey: 'notices', href: '/institution-admin/notices', icon: Bell },
                { nameKey: 'chat', href: '/chat', icon: MessagesSquare },
                {
                    nameKey: 'inquiries',
                    href: '/institution-admin/inquiries',
                    icon: MessageSquare,
                },
            ],
        },
        {
            titleKey: 'sectionSettings',
            items: [
                { nameKey: 'policy', href: '/institution-admin/policy', icon: Settings },
            ],
        },
    ],
    SUPER_ADMIN: [
        {
            titleKey: 'sectionOverview',
            items: [
                { nameKey: 'dashboard', href: '/system-admin', icon: Server, exact: true },
            ],
        },
        {
            titleKey: 'sectionPlatform',
            items: [
                { nameKey: 'tenants', href: '/system-admin/tenants', icon: Building2 },
                { nameKey: 'users', href: '/system-admin/users', icon: Users },
            ],
        },
        {
            titleKey: 'sectionCommunication',
            items: [
                { nameKey: 'smsGateway', href: '/system-admin/sms', icon: MessageSquare },
                { nameKey: 'inquiries', href: '/system-admin/inquiries', icon: MessagesSquare },
            ],
        },
        {
            titleKey: 'sectionSecurity',
            items: [
                { nameKey: 'auditLogs', href: '/system-admin/audit-logs', icon: Shield },
            ],
        },
    ],
};

const COLLAPSE_KEY = 'edulanka-sidebar-collapsed';

/** Strips the leading locale segment so hrefs from `@/i18n/routing` compare cleanly. */
function stripLocale(pathname: string): string {
    return pathname.replace(/^\/(?:en|si|ta)(?=\/|$)/, '') || '/';
}

export default function Sidebar() {
    const rawPathname = usePathname();
    const t = useTranslations('Sidebar');
    const tc = useTranslations('Common');
    const { isOpen, setIsOpen } = useSidebar();

    const [role, setRole] = React.useState<Role | null>(null);
    const [displayName, setDisplayName] = React.useState('');
    const [collapsed, setCollapsed] = React.useState(false);

    const pathname = stripLocale(rawPathname ?? '/');

    React.useEffect(() => {
        // Wrap in a function to avoid react-hooks/set-state-in-effect warning
        const init = () => {
            const authRole = authManager.getRole()?.toUpperCase();
            setRole(authRole && authRole in NAV ? (authRole as Role) : 'STUDENT');
            setDisplayName(authManager.getUserId() ?? '');
            setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
        };
        init();
    }, []);

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
            return next;
        });
    };

    const sections = role ? NAV[role] : [];
    const roleLabel = role ? role.replace(/_/g, ' ').toLowerCase() : '';

    const isItemActive = (item: NavItem) =>
        item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

    const handleSignOut = () => {
        authManager.clearAuth();
        // Full reload so no stale client cache survives the session change.
        window.location.href = '/login';
    };

    /** `mobile` forces the expanded layout inside the drawer. */
    const renderShell = (mobile: boolean) => {
        const isNarrow = collapsed && !mobile;

        return (
            <div
                className={cn(
                    'flex h-full flex-col bg-sidebar text-sidebar-foreground',
                    'transition-[width] duration-200 ease-out',
                    isNarrow ? 'w-[4.5rem]' : 'w-64',
                )}
            >
                {/* ── Brand ─────────────────────────────────────────────────── */}
                <div
                    className={cn(
                        'flex h-16 shrink-0 items-center border-b border-sidebar-border',
                        isNarrow ? 'justify-center px-3' : 'justify-between px-5',
                    )}
                >
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2.5 rounded-input outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-active"
                    >
                        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-sidebar-active text-sidebar-active-foreground">
                            <GraduationCap className="size-5" />
                        </span>
                        {!isNarrow && (
                            <span className="text-[17px] font-bold tracking-tight text-white">
                                EduLanka
                            </span>
                        )}
                    </Link>

                    {mobile ? (
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            aria-label={tc('closeMenu')}
                            className="rounded-input p-2 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-white"
                        >
                            <X className="size-5" />
                        </button>
                    ) : (
                        !isNarrow && (
                            <button
                                type="button"
                                onClick={toggleCollapsed}
                                title={t('collapse')}
                                aria-label={t('collapse')}
                                className="rounded-input p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-white"
                            >
                                <ChevronsLeft className="size-4" />
                            </button>
                        )
                    )}
                </div>

                {/* ── Navigation ────────────────────────────────────────────── */}
                <nav
                    className={cn(
                        'flex-1 overflow-y-auto overflow-x-hidden py-4',
                        isNarrow ? 'px-2.5' : 'px-3',
                    )}
                    aria-label={t('menu')}
                >
                    {isNarrow && (
                        <button
                            type="button"
                            onClick={toggleCollapsed}
                            title={t('expand')}
                            aria-label={t('expand')}
                            className="mb-3 grid h-10 w-full place-items-center rounded-input text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-white"
                        >
                            <PanelLeftOpen className="size-4" />
                        </button>
                    )}

                    {sections.map((section, sectionIndex) => (
                        <div
                            key={section.titleKey ?? `section-${sectionIndex}`}
                            className={cn(sectionIndex > 0 && (isNarrow ? 'mt-3' : 'mt-5'))}
                        >
                            {section.titleKey &&
                                (isNarrow ? (
                                    <div
                                        className="mx-auto mb-2 h-px w-6 bg-sidebar-border"
                                        aria-hidden
                                    />
                                ) : (
                                    <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.09em] text-sidebar-muted">
                                        {t(section.titleKey)}
                                    </p>
                                ))}

                            <ul className="space-y-0.5">
                                {section.items.map((item) => {
                                    const active = isItemActive(item);
                                    const Icon = item.icon;
                                    const label = t(item.nameKey);

                                    return (
                                        <li key={item.href + item.nameKey}>
                                            <Link
                                                href={item.href}
                                                onClick={() => setIsOpen(false)}
                                                aria-current={active ? 'page' : undefined}
                                                title={isNarrow ? label : undefined}
                                                className={cn(
                                                    'group relative flex items-center rounded-input text-sm font-medium outline-none',
                                                    'transition-colors duration-150',
                                                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-active',
                                                    isNarrow
                                                        ? 'h-10 justify-center'
                                                        : 'gap-3 px-3 py-2.5',
                                                    active
                                                        ? 'bg-sidebar-active text-sidebar-active-foreground'
                                                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
                                                )}
                                            >
                                                <Icon
                                                    className={cn(
                                                        'size-[18px] shrink-0 transition-colors',
                                                        active
                                                            ? 'text-sidebar-active-foreground'
                                                            : 'text-sidebar-muted group-hover:text-white',
                                                    )}
                                                />
                                                {!isNarrow && (
                                                    <span className="truncate">{label}</span>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* ── Footer ────────────────────────────────────────────────── */}
                <div
                    className={cn(
                        'shrink-0 border-t border-sidebar-border',
                        isNarrow ? 'space-y-2 p-2.5' : 'space-y-3 p-3',
                    )}
                >
                    {!isNarrow && role && (
                        <div className="flex items-center gap-2.5 rounded-input bg-sidebar-accent px-2.5 py-2">
                            <Avatar name={displayName || roleLabel} size="sm" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] font-medium text-sidebar-muted">
                                    {t('signedInAs')}
                                </p>
                                <p className="truncate text-[13px] font-semibold capitalize text-white">
                                    {roleLabel}
                                </p>
                            </div>
                        </div>
                    )}

                    {!isNarrow && (
                        <div className="flex items-center justify-between gap-2">
                            <LanguageSwitcher onDarkSurface />
                            <ThemeToggle onDarkSurface />
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleSignOut}
                        title={isNarrow ? t('signOut') : undefined}
                        className={cn(
                            'flex w-full items-center rounded-input text-sm font-medium text-sidebar-muted transition-colors',
                            'hover:bg-destructive/15 hover:text-red-300',
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-active',
                            isNarrow ? 'h-10 justify-center' : 'gap-3 px-3 py-2.5',
                        )}
                    >
                        <LogOut className="size-[18px] shrink-0" />
                        {!isNarrow && <span>{t('signOut')}</span>}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Desktop */}
            <aside className="hidden shrink-0 border-r border-sidebar-border md:flex">
                {renderShell(false)}
            </aside>

            {/* Mobile drawer */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.16 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 z-40 bg-scrim/50 backdrop-blur-sm md:hidden"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
                            className="fixed inset-y-0 left-0 z-50 shadow-modal md:hidden"
                        >
                            {renderShell(true)}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
