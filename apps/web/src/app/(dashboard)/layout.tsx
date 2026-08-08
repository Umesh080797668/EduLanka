import type { Metadata } from 'next';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import RouteGuard from './RouteGuard';

export const metadata: Metadata = {
    title: 'EduLanka Dashboard',
    description: 'EduLanka Premium Dashboard',
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RouteGuard>
            <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Header />
                    <main className="flex-1 overflow-x-hidden overflow-y-auto">
                        <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-full">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </RouteGuard>
    );
}
