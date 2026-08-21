'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Form';
import { PageHeader } from '@/components/ui/Layout';

export default function AdminNoticesPage() {
    const t = useTranslations('Notices');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [scope, setScope] = useState('SCHOOL_WIDE');
    const [priority, setPriority] = useState('NORMAL');
    const [sendSms, setSendSms] = useState(false);
    const [targetGroupId, setTargetGroupId] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await apiClient.post(
                '/notices',
                {
                    title,
                    content_html: content,
                    scope,
                    target_grade: scope === 'GRADE_LEVEL' ? targetGroupId : null,
                    target_class_id:
                        scope === 'CLASS_SPECIFIC' ? targetGroupId : null,
                    priority,
                    send_sms: sendSms,
                },
                { skipGlobalToast: true },
            );
            toast.success(t('noticeCreatedSuccess'));
            setTitle('');
            setContent('');
        } catch (err: any) {
            toast.error(err?.message || t('noticeCreateFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-3xl">
            <PageHeader
                icon={<Megaphone />}
                title={t('createNotice')}
                description={t('createNoticeDescription')}
            />

            <motion.form
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit}
            >
                <Card>
                    <CardContent className="space-y-6 pt-6">
                        <Field label={t('title')} htmlFor="notice-title" required>
                            <Input
                                id="notice-title"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={t('titlePlaceholder')}
                            />
                        </Field>

                        <Field label={t('content')} htmlFor="notice-content" required>
                            <Textarea
                                id="notice-content"
                                required
                                rows={6}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder={t('contentPlaceholder')}
                            />
                        </Field>

                        {/* ── Targeting ─────────────────────────────────────── */}
                        <div className="grid gap-4 rounded-card border border-border bg-muted/40 p-4 sm:grid-cols-2">
                            <Field label={t('scope')} htmlFor="notice-scope">
                                <Select
                                    id="notice-scope"
                                    value={scope}
                                    onChange={(e) => setScope(e.target.value)}
                                >
                                    <option value="SCHOOL_WIDE">
                                        {t('scope_SCHOOL_WIDE')}
                                    </option>
                                    <option value="GRADE_LEVEL">
                                        {t('scope_GRADE_LEVEL')}
                                    </option>
                                    <option value="CLASS_SPECIFIC">
                                        {t('scope_CLASS_SPECIFIC')}
                                    </option>
                                </Select>
                            </Field>

                            <Field label={t('priority')} htmlFor="notice-priority">
                                <Select
                                    id="notice-priority"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                >
                                    <option value="LOW">{t('priority_LOW')}</option>
                                    <option value="NORMAL">
                                        {t('priority_NORMAL')}
                                    </option>
                                    <option value="HIGH">{t('priority_HIGH')}</option>
                                    <option value="URGENT">
                                        {t('priority_URGENT')}
                                    </option>
                                </Select>
                            </Field>

                            {scope !== 'SCHOOL_WIDE' && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="sm:col-span-2"
                                >
                                    <Field
                                        label={t('targetId')}
                                        htmlFor="notice-target"
                                        required
                                    >
                                        <Input
                                            id="notice-target"
                                            required
                                            value={targetGroupId}
                                            onChange={(e) =>
                                                setTargetGroupId(e.target.value)
                                            }
                                            placeholder={t('targetIdPlaceholder')}
                                        />
                                    </Field>
                                </motion.div>
                            )}
                        </div>

                        <Switch
                            checked={sendSms}
                            onCheckedChange={setSendSms}
                            label={t('sendSmsPrompt')}
                            hint={t('sendSmsDescription')}
                        />

                        <Button
                            type="submit"
                            block
                            size="lg"
                            loading={submitting}
                            leadingIcon={<Send />}
                        >
                            {t('publishNotice')}
                        </Button>
                    </CardContent>
                </Card>
            </motion.form>
        </div>
    );
}
