"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function AdminNoticesPage() {
    const t = useTranslations('Notices');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [scope, setScope] = useState('SCHOOL_WIDE');
    const [priority, setPriority] = useState('NORMAL');
    const [sendSms, setSendSms] = useState(false);
    const [targetGroupId, setTargetGroupId] = useState('');

    const supabase = createSupabaseBrowserClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/notices`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                content_html: content,
                scope,
                target_group_id: scope === 'SCHOOL_WIDE' ? null : targetGroupId,
                priority,
                send_sms: sendSms
            })
        });

        if (res.ok) {
            toast.success(t('noticeCreatedSuccess'));
            setTitle('');
            setContent('');
        } else {
            const err = await res.json();
            toast.error(err.message || t('noticeCreateFailed'));
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-10 px-6">
            <header className="mb-10">
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t('createNotice')}</h1>
                <p className="text-muted-foreground mt-2">{t('createNoticeDescription')}</p>
            </header>

            <form onSubmit={handleSubmit} className="bg-card p-8 rounded-3xl border border-border/50 shadow-sm space-y-8">

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">{t('title')}</label>
                    <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full flex h-12 rounded-xl border border-input/50 bg-background/50 px-4 text-[15px] focus:bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all" placeholder={t('titlePlaceholder')} />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">{t('content')}</label>
                    <textarea required rows={6} value={content} onChange={e => setContent(e.target.value)} className="w-full flex rounded-xl border border-input/50 bg-background/50 px-4 py-3 text-[15px] focus:bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none" placeholder={t('contentPlaceholder')} />
                </div>

                <div className="grid grid-cols-2 gap-6 p-5 bg-muted/30 rounded-2xl border border-border/30">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">{t('scope')}</label>
                        <select value={scope} onChange={e => setScope(e.target.value)} className="w-full h-11 rounded-xl border border-input/50 bg-background px-3 text-sm focus:ring-2 focus:ring-primary">
                            <option value="SCHOOL_WIDE">{t('scope_SCHOOL_WIDE')}</option>
                            <option value="GRADE_LEVEL">{t('scope_GRADE_LEVEL')}</option>
                            <option value="CLASS_SPECIFIC">{t('scope_CLASS_SPECIFIC')}</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">{t('priority')}</label>
                        <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full h-11 rounded-xl border border-input/50 bg-background px-3 text-sm focus:ring-2 focus:ring-primary">
                            <option value="LOW">{t('priority_LOW')}</option>
                            <option value="NORMAL">{t('priority_NORMAL')}</option>
                            <option value="HIGH">{t('priority_HIGH')}</option>
                            <option value="URGENT">{t('priority_URGENT')}</option>
                        </select>
                    </div>
                </div>

                {scope !== 'SCHOOL_WIDE' && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
                        <label className="text-sm font-semibold text-foreground">{t('targetId')}</label>
                        <input value={targetGroupId} onChange={e => setTargetGroupId(e.target.value)} className="w-full h-11 rounded-xl border border-input/50 bg-background px-4 text-sm" placeholder={t('targetIdPlaceholder')} />
                    </div>
                )}

                <div className="flex items-center space-x-3 p-4 border border-border/50 rounded-xl bg-background/50">
                    <input type="checkbox" id="sendSms" checked={sendSms} onChange={e => setSendSms(e.target.checked)} className="h-5 w-5 rounded border-input text-primary focus:ring-primary focus:ring-offset-0 transition-colors cursor-pointer" />
                    <div className="flex flex-col cursor-pointer" onClick={() => setSendSms(!sendSms)}>
                        <label className="text-sm font-semibold text-foreground cursor-pointer">{t('sendSmsPrompt')}</label>
                        <span className="text-xs text-muted-foreground">{t('sendSmsDescription')}</span>
                    </div>
                </div>

                <button type="submit" className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    {t('publishNotice')}
                </button>
            </form>
        </div>
    );
}
