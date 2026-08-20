"use client";

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function NoticeFeed() {
    const [notices, setNotices] = useState<any[]>([]);
    const t = useTranslations('Notices');
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        const fetchNotices = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/notices`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setNotices(data);
                }
            }
        };
        fetchNotices();
    }, [supabase]);

    const markAsRead = async (id: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/notices/${id}/read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            setNotices(notices.map(n => n.id === id ? { ...n, is_read: true } : n));
        }
    };

    if (notices.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">{t('noNotices')}</div>;
    }

    return (
        <div className="space-y-4">
            {notices.map(notice => (
                <div key={notice.id} className={`p-5 rounded-2xl border transition-all hover:shadow-md ${notice.priority === 'URGENT' ? 'border-red-500 bg-red-50/10' : notice.priority === 'HIGH' ? 'border-orange-500 bg-orange-50/10' : 'border-border bg-card'}`}>
                    <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-lg tracking-tight">{notice.title}</h4>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border ${notice.priority === 'URGENT' ? 'bg-red-500 text-white border-red-600' : notice.priority === 'HIGH' ? 'bg-orange-500 text-white border-orange-600' : 'bg-muted text-muted-foreground'}`}>
                            {t(`priority_${notice.priority}`)}
                        </span>
                    </div>

                    <div className="text-[15px] leading-relaxed text-muted-foreground mb-6" dangerouslySetInnerHTML={{ __html: notice.content_html }}></div>

                    <div className="flex justify-between items-center pt-3 border-t border-border/50">
                        <div className="flex flex-col">
                            <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                                {new Date(notice.created_at).toLocaleDateString()}
                            </span>
                            <span className="text-foreground text-xs font-semibold mt-1">
                                {notice.author?.first_name} {notice.author?.last_name}
                            </span>
                        </div>

                        {!notice.is_read ? (
                            <button onClick={() => markAsRead(notice.id)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-transform active:scale-95 shadow-sm">
                                {t('acknowledge')}
                            </button>
                        ) : (
                            <span className="text-green-500 font-bold bg-green-50/50 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 border border-green-200">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                {t('acknowledged')}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
