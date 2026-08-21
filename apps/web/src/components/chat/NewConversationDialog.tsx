'use client';

import * as React from 'react';
import { Search, Users, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { apiClient } from '@/lib/api-client';
import { authManager } from '@/lib/auth-store';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Checkbox, Field, Input } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/Layout';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import type { Conversation } from './types';

interface DirectoryEntry {
    user_id: string;
    full_name: string | null;
    role: string | null;
    avatar_url: string | null;
}

/** Only staff may open an ad-hoc group; everyone can start a direct thread. */
const GROUP_CREATORS = ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'];

const ROLE_KEYS = ['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'];

type Mode = 'direct' | 'group';

interface NewConversationDialogProps {
    open: boolean;
    onClose: () => void;
    onCreated: (conversation: Conversation) => void;
}

export default function NewConversationDialog({
    open,
    onClose,
    onCreated,
}: NewConversationDialogProps) {
    const t = useTranslations('Chat');
    const [mode, setMode] = React.useState<Mode>('direct');
    const [directory, setDirectory] = React.useState<DirectoryEntry[] | null>(null);
    const [query, setQuery] = React.useState('');
    const [selected, setSelected] = React.useState<string[]>([]);
    const [groupName, setGroupName] = React.useState('');
    const [busy, setBusy] = React.useState<string | null>(null);

    const canCreateGroup = GROUP_CREATORS.includes(authManager.getRole());

    React.useEffect(() => {
        if (!open) return;
        let isMounted = true;
        // Re-pull on every open — rosters change while the tab stays parked.
        apiClient
            .get<DirectoryEntry[]>('/chat/directory', { skipGlobalToast: true })
            .then((data) => {
                if (isMounted) setDirectory(Array.isArray(data) ? data : []);
            })
            .catch((err: any) => {
                if (isMounted) {
                    setDirectory([]);
                    toast.error(t('directoryFailed'), { description: err?.message });
                }
            });
        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    /** Localised role label, falling back to the raw value for unmapped roles. */
    const roleLabel = (role: string | null): string => {
        if (!role) return '';
        return ROLE_KEYS.includes(role) ? t(`role_${role}` as 'role_TEACHER') : role;
    };

    const term = query.trim().toLowerCase();
    const visible = (directory ?? []).filter((entry) =>
        term ? (entry.full_name ?? '').toLowerCase().includes(term) : true,
    );

    const reset = () => {
        setQuery('');
        setSelected([]);
        setGroupName('');
        setBusy(null);
    };

    const close = () => {
        reset();
        onClose();
    };

    const startDirect = async (entry: DirectoryEntry) => {
        setBusy(entry.user_id);
        try {
            const conversation = await apiClient.post<Conversation>(
                '/chat/conversations/direct',
                { userId: entry.user_id },
                { skipGlobalToast: true },
            );
            onCreated(conversation);
            close();
        } catch (err: any) {
            toast.error(t('startFailed'), { description: err?.message });
            setBusy(null);
        }
    };

    const createGroup = async () => {
        setBusy('group');
        try {
            const conversation = await apiClient.post<Conversation>(
                '/chat/conversations/group',
                { name: groupName.trim(), memberIds: selected },
                { skipGlobalToast: true },
            );
            onCreated(conversation);
            close();
        } catch (err: any) {
            toast.error(t('startFailed'), { description: err?.message });
            setBusy(null);
        }
    };

    const toggle = (userId: string) => {
        setSelected((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
        );
    };

    return (
        <Dialog
            open={open}
            onClose={close}
            title={t('newConversation')}
            description={t('newConversationDescription')}
            icon={<UserPlus />}
            size="md"
            footer={
                mode === 'group' ? (
                    <>
                        <Button variant="ghost" onClick={close}>
                            {t('cancel')}
                        </Button>
                        <Button
                            leadingIcon={<Users />}
                            loading={busy === 'group'}
                            disabled={!groupName.trim() || selected.length === 0}
                            onClick={() => void createGroup()}
                        >
                            {selected.length > 0
                                ? t('createGroupWithCount', { count: selected.length })
                                : t('createGroup')}
                        </Button>
                    </>
                ) : undefined
            }
        >
            <div className="space-y-4">
                {canCreateGroup && (
                    <Tabs
                        variant="pill"
                        aria-label={t('newConversation')}
                        value={mode}
                        onValueChange={(next) => {
                            setMode(next as Mode);
                            setSelected([]);
                        }}
                        items={[
                            { value: 'direct', label: t('directMessage') },
                            { value: 'group', label: t('groupChat') },
                        ]}
                    />
                )}

                {mode === 'group' && (
                    <Field label={t('groupName')} required htmlFor="chat-group-name">
                        <Input
                            id="chat-group-name"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder={t('groupNamePlaceholder')}
                            maxLength={255}
                        />
                    </Field>
                )}

                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('searchPeople')}
                    aria-label={t('searchPeople')}
                    leadingIcon={<Search className="size-4" />}
                    autoComplete="off"
                />

                {directory === null ? (
                    <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, idx) => (
                            <div key={idx} className="flex items-center gap-3 py-1.5">
                                <Skeleton className="size-8 shrink-0 rounded-full" />
                                <Skeleton className="h-3.5 w-2/5" />
                            </div>
                        ))}
                    </div>
                ) : visible.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={<Search />}
                        title={term ? t('noPeopleMatch') : t('noPeopleAvailable')}
                    />
                ) : (
                    <ul className="scrollbar-none max-h-72 divide-y divide-border overflow-y-auto">
                        {visible.map((entry) => {
                            const name = entry.full_name || t('untitled');

                            if (mode === 'group') {
                                return (
                                    <li key={entry.user_id} className="flex items-center gap-3 py-2.5">
                                        <Checkbox
                                            checked={selected.includes(entry.user_id)}
                                            onChange={() => toggle(entry.user_id)}
                                            aria-label={name}
                                        />
                                        <Avatar
                                            size="sm"
                                            name={name}
                                            src={entry.avatar_url || undefined}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-foreground">
                                                {name}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {roleLabel(entry.role)}
                                            </p>
                                        </div>
                                    </li>
                                );
                            }

                            return (
                                <li key={entry.user_id}>
                                    <button
                                        type="button"
                                        disabled={!!busy}
                                        onClick={() => void startDirect(entry)}
                                        className={cn(
                                            'flex w-full items-center gap-3 rounded-input px-2 py-2.5 text-left transition-colors',
                                            'hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                                            busy === entry.user_id && 'bg-muted',
                                            !!busy && busy !== entry.user_id && 'opacity-55',
                                        )}
                                    >
                                        <Avatar
                                            size="sm"
                                            name={name}
                                            src={entry.avatar_url || undefined}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-foreground">
                                                {name}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {roleLabel(entry.role)}
                                            </p>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </Dialog>
    );
}
