'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    BookOpen,
    ChevronRight,
    Pencil,
    Plus,
    Star,
    Trash2,
    Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import { deleteClass, fetchClasses, RequestOpts } from '@/lib/api/school';
import type { ClassProfile } from '@edu-lanka/shared-types';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Form';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import MultiStepModal from '@/components/ui/MultiStepModal';
import { Spinner } from '@/components/ui/Spinner';
import {
    Table,
    TableWrap,
    TBody,
    TD,
    TH,
    THead,
    TR,
} from '@/components/ui/Table';

export default function ClassesPage() {
    const t = useTranslations('InstitutionAdminClasses');
    const tc = useTranslations('Common');
    const tf = useTranslations('Confirm');
    const [classes, setClasses] = useState<ClassProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [classToDelete, setClassToDelete] = useState<ClassProfile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [classToEdit, setClassToEdit] = useState<ClassProfile | null>(null);
    const [editForm, setEditForm] = useState({
        year: new Date().getFullYear(),
        section: '',
    });
    const [savingEdit, setSavingEdit] = useState(false);

    const openEditModal = (cls: ClassProfile) => {
        setEditForm({ year: cls.year, section: cls.section });
        setClassToEdit(cls);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!classToEdit) return;
        setSavingEdit(true);
        try {
            const { updateClass } = await import('@/lib/api/school');
            const opts: RequestOpts = {
                token: authManager.getToken() || '',
                tenantId: authManager.getTenantId() || '',
            };
            const updated = await updateClass(classToEdit.id, editForm, opts);
            setClasses((prev) =>
                prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
            );
            setClassToEdit(null);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!classToDelete) return;
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        await deleteClass(classToDelete.id, opts);
        setClasses((prev) => prev.filter((c) => c.id !== classToDelete.id));
    };

    useEffect(() => {
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        fetchClasses(opts)
            .then(setClasses)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                icon={<BookOpen />}
                title={t('title')}
                description={t('description')}
                badge={
                    !loading && classes.length > 0 ? (
                        <Badge tone="primary" dot>
                            {classes.length}
                        </Badge>
                    ) : undefined
                }
                actions={
                    <Link
                        href="/institution-admin/classes/new"
                        className={buttonClass({ variant: 'primary' })}
                    >
                        <Plus className="size-4" />
                        {t('createClass')}
                    </Link>
                }
            />

            {error && (
                <Alert tone="danger" className="mb-6" onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {!loading && classes.length === 0 ? (
                <EmptyState
                    icon={<BookOpen />}
                    title={t('noClasses')}
                    action={
                        <Link
                            href="/institution-admin/classes/new"
                            className={buttonClass({ variant: 'primary' })}
                        >
                            <Plus className="size-4" />
                            {t('createClass')}
                        </Link>
                    }
                />
            ) : (
                <div className="relative min-h-[300px]">
                    <AnimatePresence>
                        {loading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-card bg-background/70 backdrop-blur-sm"
                            >
                                <Spinner />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <TableWrap>
                        <Table>
                            <THead>
                                <TR>
                                    <TH>{t('classLabel')}</TH>
                                    <TH className="w-28">{t('section')}</TH>
                                    <TH className="w-24">{t('year')}</TH>
                                    <TH className="w-32">{t('medium')}</TH>
                                    <TH className="w-28">{t('students')}</TH>
                                    <TH>{t('homeroomTeacher')}</TH>
                                    <TH align="right" className="w-48">
                                        {t('actions')}
                                    </TH>
                                </TR>
                            </THead>
                            <TBody>
                                {classes.map((cls, idx) => {
                                    const homeroomTeacher = (
                                        cls as any
                                    ).class_teachers?.find((ct: any) => ct.is_homeroom);
                                    const homeroomName =
                                        homeroomTeacher?.teachers?.users?.full_name ||
                                        null;
                                    const gradeName =
                                        (cls as any).grades?.name ||
                                        (cls as any).grade?.name ||
                                        `${t('gradeShort')} ${(cls as any).grade ?? '?'}`;

                                    return (
                                        <motion.tr
                                            key={cls.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{
                                                opacity: 1,
                                                y: 0,
                                                transition: {
                                                    delay: Math.min(idx * 0.03, 0.3),
                                                },
                                            }}
                                            className="group transition-colors hover:bg-accent/60"
                                        >
                                            <TD>
                                                <div className="flex items-center gap-3">
                                                    <span className="grid size-10 shrink-0 place-items-center rounded-input bg-primary-subtle text-sm font-bold text-primary">
                                                        {gradeName
                                                            .toString()
                                                            .replace(
                                                                `${t('gradeShort')} `,
                                                                'G',
                                                            )}
                                                    </span>
                                                    <span className="font-semibold text-foreground transition-colors group-hover:text-primary">
                                                        {gradeName}
                                                    </span>
                                                </div>
                                            </TD>
                                            <TD>
                                                <Badge tone="neutral" variant="outline">
                                                    {cls.section}
                                                </Badge>
                                            </TD>
                                            <TD numeric className="text-muted-foreground">
                                                {cls.year}
                                            </TD>
                                            <TD>
                                                {cls.medium ? (
                                                    <Badge tone="info">
                                                        {cls.medium}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-sm italic text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </TD>
                                            <TD>
                                                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                                                    <Users className="size-3.5 text-muted-foreground" />
                                                    {(cls as any).students?.length ?? 0}
                                                </span>
                                            </TD>
                                            <TD>
                                                {homeroomName ? (
                                                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                                                        <Star className="size-3.5 text-warning" />
                                                        {homeroomName}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm italic text-muted-foreground">
                                                        {t('unassigned')}
                                                    </span>
                                                )}
                                            </TD>
                                            <TD align="right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label={t('edit')}
                                                        title={t('edit')}
                                                        onClick={() =>
                                                            openEditModal(cls)
                                                        }
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                    <Link
                                                        href={`/institution-admin/classes/${cls.id}`}
                                                        className={buttonClass({
                                                            variant: 'outline',
                                                            size: 'sm',
                                                        })}
                                                    >
                                                        {t('manage')}
                                                        <ChevronRight className="size-3.5" />
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label={t('deleteClass')}
                                                        title={t('deleteClass')}
                                                        onClick={() =>
                                                            setClassToDelete(cls)
                                                        }
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </TD>
                                        </motion.tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </TableWrap>
                </div>
            )}

            <MultiStepModal
                isOpen={!!classToDelete}
                onClose={() => setClassToDelete(null)}
                title={t('deleteClass')}
                steps={[
                    {
                        title: tf('sureTitle'),
                        description: t('deleteNamed', {
                            section: classToDelete?.section ?? '',
                        }),
                        confirmText: tf('proceed'),
                        isDestructive: true,
                    },
                    {
                        title: tf('deleteTitle'),
                        description: tf('deleteDesc'),
                        confirmText: t('deleteClass'),
                        isDestructive: true,
                    },
                ]}
                onComplete={handleDeleteConfirm}
            />

            {/* ── Inline edit ───────────────────────────────────────────────── */}
            <Dialog
                open={!!classToEdit}
                onClose={() => setClassToEdit(null)}
                title={t('editClass')}
                icon={<Pencil />}
                size="sm"
                dismissible={!savingEdit}
            >
                <form onSubmit={handleEditSubmit} className="space-y-5">
                    <Field label={t('academicYear')} htmlFor="edit-year" required>
                        <Input
                            id="edit-year"
                            type="number"
                            required
                            min={2000}
                            max={2100}
                            value={editForm.year}
                            onChange={(e) =>
                                setEditForm((prev) => ({
                                    ...prev,
                                    year: parseInt(e.target.value, 10),
                                }))
                            }
                        />
                    </Field>

                    <Field
                        label={t('sectionLabel')}
                        hint={t('sectionHint')}
                        htmlFor="edit-section"
                        required
                    >
                        <Input
                            id="edit-section"
                            type="text"
                            required
                            value={editForm.section}
                            onChange={(e) =>
                                setEditForm((prev) => ({
                                    ...prev,
                                    section: e.target.value,
                                }))
                            }
                        />
                    </Field>

                    <div className="flex justify-end gap-3 pt-1">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setClassToEdit(null)}
                            disabled={savingEdit}
                        >
                            {tc('cancel')}
                        </Button>
                        <Button type="submit" loading={savingEdit}>
                            {t('saveChanges')}
                        </Button>
                    </div>
                </form>
            </Dialog>
        </div>
    );
}
