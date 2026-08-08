'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    GraduationCap,
    BookOpen,
    Users,
    Settings,
    LogOut
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const NAV_ITEMS = {
    STUDENT: [
        { name: 'Dashboard', href: '/student', icon: LayoutDashboard },
        { name: 'Grades & Reports', href: '/student/grades', icon: GraduationCap },
    ],
    PARENT: [
        { name: 'Dashboard', href: '/parent', icon: LayoutDashboard },
    ],
    TEACHER: [
        { name: 'Dashboard', href: '/teacher', icon: LayoutDashboard },
        { name: 'Classes & Grades', href: '/teacher/classes', icon: BookOpen },
    ],
    ADMIN: [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Users', href: '/admin/users', icon: Users },
        { name: 'Policy', href: '/admin/policy', icon: Settings },
    ]
};

export default function Sidebar() {
    const pathname = usePathname();
    const [role, setRole] = useState<'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN' | null>(null);

    useEffect(() => {
        // Basic resolution of role based on route for UI demo purposes
        if (pathname?.startsWith('/admin')) setRole('ADMIN');
        else if (pathname?.startsWith('/teacher')) setRole('TEACHER');
        else if (pathname?.startsWith('/parent')) setRole('PARENT');
        else if (pathname?.startsWith('/student')) setRole('STUDENT');
        else setRole('STUDENT'); // Fallback
    }, [pathname]);

    const items = role ? NAV_ITEMS[role] : [];

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0 flex flex-col text-slate-300">
            <div className="h-16 flex items-center px-6 border-b border-slate-800">
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="font-bold text-xl text-white tracking-tight flex items-center gap-2"
                >
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                        <GraduationCap className="w-5 h-5" />
                    </div>
                    EduLanka
                </motion.div>
            </div>

            <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
                <p className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                    Menu
                </p>
                {items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                    const Icon = item.icon;
                    return (
                        <Link key={item.name} href={item.href}>
                            <span
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${isActive
                                    ? 'bg-indigo-600 text-white'
                                    : 'hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-200' : 'text-slate-400 group-hover:text-white'}`} />
                                <span className="font-medium text-sm">{item.name}</span>
                                {isActive && (
                                    <motion.div
                                        layoutId="active-nav-indicator"
                                        className="absolute left-0 w-1 h-full bg-white rounded-r-full"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                            </span>
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={() => {
                        localStorage.clear();
                        window.location.href = '/login';
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/50 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium text-sm">Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
