import type { Metadata } from 'next';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import RouteGuard from './RouteGuard';
import { SidebarProvider } from '@/components/layout/SidebarContext';

export const metadata: Metadata = {
    title: 'Dashboard',
    description: 'EduLanka school management dashboard.',
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RouteGuard>
            <SidebarProvider>
                <div className="flex min-h-dvh bg-background text-foreground">
                    <Sidebar />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <Header />
                        {/* id is the target of the root layout's skip-to-content link. */}
                        <main
                            id="main-content"
                            className="flex-1 overflow-x-hidden"
                            tabIndex={-1}
                        >
                            <div className="mx-auto min-h-full w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                                {children}
                            </div>
                        </main>
                    </div>
                </div>
            </SidebarProvider>
        </RouteGuard>
    );
}
