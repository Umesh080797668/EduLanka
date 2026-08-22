'use client';

import * as React from 'react';
import { Check, ListChecks, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { SUBJECT_GROUPS, subjectLabel } from '@/lib/subject-areas';
import type { SubjectArea } from '@edu-lanka/shared-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Checkbox, Input } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/Layout';

interface SubjectAreaDialogProps {
    open: boolean;
    onClose: () => void;
    /** Controlled selection — the caller owns it, so there is no draft to reset. */
    value: SubjectArea[];
    onChange: (next: SubjectArea[]) => void;
    /**
     * Supplied when the selection has to be persisted, which turns the footer
     * into cancel + save. Omit it for form-local use, where the surrounding form
     * submits the value later.
     */
    onConfirm?: () => void;
    saving?: boolean;
}

/**
 * Picker for the 80-subject curriculum enum: searchable, grouped by curriculum
 * band, and multi-select. There is no dropdown primitive in the kit, and a
 * plain `<select multiple>` is unusable at this size on a phone — so this is a
 * dialog with a filtered checkbox grid.
 */
export function SubjectAreaDialog({
    open,
    onClose,
    value,
    onChange,
    onConfirm,
    saving = false,
}: SubjectAreaDialogProps) {
    const t = useTranslations('InstitutionAdminTeachers');
    const tc = useTranslations('Common');
    const [query, setQuery] = React.useState('');

    const close = () => {
        setQuery('');
        onClose();
    };

    const toggle = (subject: SubjectArea) => {
        onChange(
            value.includes(subject)
                ? value.filter((item) => item !== subject)
                : [...value, subject],
        );
    };

    const term = query.trim().toLowerCase();
    const groups = SUBJECT_GROUPS.map((group) => ({
        key: group.key,
        subjects: term
            ? group.subjects.filter((subject) =>
                  subjectLabel(subject).toLowerCase().includes(term),
              )
            : group.subjects,
    })).filter((group) => group.subjects.length > 0);

    return (
        <Dialog
            open={open}
            onClose={close}
            title={t('manageSubjects')}
            description={t('manageSubjectsDesc')}
            icon={<ListChecks />}
            size="lg"
            footer={
                <>
                    <Button variant="ghost" onClick={close} disabled={saving}>
                        {onConfirm ? tc('cancel') : tc('close')}
                    </Button>
                    {onConfirm && (
                        <Button
                            leadingIcon={<Check />}
                            loading={saving}
                            onClick={onConfirm}
                        >
                            {tc('save')}
                        </Button>
                    )}
                </>
            }
        >
            <div className="space-y-4">
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('searchSubjects')}
                    aria-label={t('searchSubjects')}
                    leadingIcon={<Search className="size-4" />}
                    autoComplete="off"
                />

                <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {t('selectedCount', { count: value.length })}
                    </p>
                    {value.length > 0 && (
                        <Button variant="ghost" size="xs" onClick={() => onChange([])}>
                            {t('clearAll')}
                        </Button>
                    )}
                </div>

                {groups.length === 0 ? (
                    <EmptyState size="sm" icon={<Search />} title={t('noSubjectsMatch')} />
                ) : (
                    <div className="scrollbar-none max-h-[52vh] space-y-5 overflow-y-auto pr-1">
                        {groups.map((group) => {
                            const chosen = group.subjects.filter((subject) =>
                                value.includes(subject),
                            ).length;

                            return (
                                <section key={group.key}>
                                    <div className="mb-2 flex items-center gap-2">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            {t(
                                                `subjectGroup_${group.key}` as 'subjectGroup_core',
                                            )}
                                        </h3>
                                        {chosen > 0 && (
                                            <Badge tone="primary" variant="soft" size="sm">
                                                {chosen}
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="grid gap-1 sm:grid-cols-2">
                                        {group.subjects.map((subject) => {
                                            const checked = value.includes(subject);
                                            const label = subjectLabel(subject);

                                            return (
                                                <label
                                                    key={subject}
                                                    className={cn(
                                                        'flex cursor-pointer items-center gap-2.5 rounded-input px-2 py-1.5 text-sm transition-colors',
                                                        checked
                                                            ? 'bg-primary-subtle text-primary-subtle-foreground font-semibold'
                                                            : 'text-foreground hover:bg-muted',
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={checked}
                                                        onChange={() => toggle(subject)}
                                                        aria-label={label}
                                                    />
                                                    <span className="min-w-0 flex-1 truncate">
                                                        {label}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>
        </Dialog>
    );
}

export default SubjectAreaDialog;
