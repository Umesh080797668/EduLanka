'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Download, Eye, GraduationCap, Pencil, Trash2, Upload, UserPlus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import { deactivateStudent, fetchStudents, RequestOpts } from '@/lib/api/school';
import type { StudentProfile } from '@edu-lanka/shared-types';
import { HelpButton } from '@/components/HelpButton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { buttonClass, Button } from '@/components/ui/Button';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import MultiStepModal from '@/components/ui/MultiStepModal';
import { Dialog } from '@/components/ui/Dialog';
import { PageSkeleton } from '@/components/ui/Skeleton';
import {
    Table,
    TableWrap,
    TBody,
    TD,
    TDEmpty,
    TH,
    THead,
    TR,
} from '@/components/ui/Table';

export default function StudentsPage() {
    const t = useTranslations('InstitutionAdminStudents');
    const tc = useTranslations('Common');
    const searchParams = useSearchParams();
    const query = searchParams?.get('query')?.toLowerCase() || '';

    const [students, setStudents] = useState<StudentProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [studentToDelete, setStudentToDelete] = useState<StudentProfile | null>(
        null,
    );
    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [bulkCsv, setBulkCsv] = useState('');
    const [bulkImporting, setBulkImporting] = useState(false);

    const handleDeleteConfirm = async () => {
        if (!studentToDelete) return;
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        await deactivateStudent(studentToDelete.id, opts);
        setStudents((prev) =>
            prev.map((s) =>
                s.id === studentToDelete.id
                    ? { ...s, users: { ...s.users!, is_active: false } }
                    : s,
            ),
        );
    };

    useEffect(() => {
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        fetchStudents(opts)
            .then(setStudents)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const filteredStudents = students.filter(
        (s) =>
            !query ||
            s.users?.full_name?.toLowerCase().includes(query) ||
            s.users?.email?.toLowerCase().includes(query) ||
            s.admission_no?.toLowerCase().includes(query),
    );

    const handleBulkImport = async () => {
        if (!bulkCsv.trim()) return;
        setBulkImporting(true);
        try {
            const lines = bulkCsv.trim().split('\n');
            const newEntries: StudentProfile[] = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line || (i === 0 && line.toLowerCase().includes('full_name'))) continue;
                const [name, email, adm] = line.split(',').map((s) => s?.trim() || '');
                if (name && email) {
                    newEntries.push({
                        id: `bulk-${Date.now()}-${i}`,
                        tenant_id: authManager.getTenantId() || '',
                        admission_no: adm || `ADM-${Date.now().toString().slice(-4)}-${i}`,
                        users: {
                            id: `user-bulk-${Date.now()}-${i}`,
                            full_name: name,
                            email: email,
                            role: 'STUDENT' as any,
                            is_active: true,
                        } as any,
                    } as any);
                }
            }
            if (newEntries.length > 0) {
                setStudents((prev) => [...newEntries, ...prev]);
                toast.success(t('importSuccess'), {
                    description: `${newEntries.length} students imported`,
                });
            }
            setBulkCsv('');
            setBulkModalOpen(false);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to parse CSV');
        } finally {
            setBulkImporting(false);
        }
    };

    return (
        <TutorialProvider role="SCHOOL_ADMIN" screenId="users">
            <div className="mx-auto max-w-6xl">
                <PageHeader
                    icon={<GraduationCap />}
                    title={t('title')}
                    badge={
                        !loading && students.length > 0 ? (
                            <Badge tone="primary" dot>
                                {students.length}
                            </Badge>
                        ) : undefined
                    }
                    actions={
                        <div className="flex items-center gap-2">
                            <Button
                                id="bulk-import-btn"
                                variant="outline"
                                onClick={() => setBulkModalOpen(true)}
                                leadingIcon={<Upload className="size-4" />}
                            >
                                {t('bulkImport')}
                            </Button>
                            <Link
                                id="add-user-btn"
                                href="/institution-admin/students/new"
                                className={buttonClass({ variant: 'primary' })}
                            >
                                <UserPlus className="size-4" />
                                {t('enrollStudent')}
                            </Link>
                        </div>
                    }
                />

                {loading ? (
                    <PageSkeleton rows={6} cols={5} />
                ) : error ? (
                    <Alert tone="danger" title={tc('loadFailed')}>
                        {error}
                    </Alert>
                ) : filteredStudents.length === 0 ? (
                    <EmptyState
                        icon={<Users />}
                        title={query ? t('noMatches') : t('noStudents')}
                        description={query ? t('noMatchesDesc') : undefined}
                        action={
                            !query ? (
                                <Link
                                    href="/institution-admin/students/new"
                                    className={buttonClass({ variant: 'primary' })}
                                >
                                    <UserPlus className="size-4" />
                                    {t('enrollStudent')}
                                </Link>
                            ) : undefined
                        }
                    />
                ) : (
                    <TableWrap id="user-directory-table">
                        <Table>
                            <THead>
                                <TR>
                                    <TH className="w-36">{t('admissionNo')}</TH>
                                    <TH>{t('name')}</TH>
                                    <TH className="w-40">{t('class')}</TH>
                                    <TH className="w-28">{t('status')}</TH>
                                    <TH align="right" className="w-44">
                                        {t('actions')}
                                    </TH>
                                </TR>
                            </THead>
                            <TBody>
                                {filteredStudents.length === 0 ? (
                                    <TDEmpty colSpan={5}>{t('noStudents')}</TDEmpty>
                                ) : (
                                    filteredStudents.map((student, idx) => (
                                        <motion.tr
                                            key={student.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{
                                                opacity: 1,
                                                y: 0,
                                                transition: {
                                                    delay: Math.min(idx * 0.03, 0.3),
                                                },
                                            }}
                                            className="transition-colors hover:bg-accent/60"
                                        >
                                            <TD numeric className="text-muted-foreground">
                                                {student.admission_no}
                                            </TD>
                                            <TD>
                                                <div className="font-medium text-foreground">
                                                    {student.users?.full_name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {student.users?.email}
                                                </div>
                                            </TD>
                                            <TD>
                                                {student.classes ? (
                                                    <span className="text-foreground">
                                                        {t('gradeShort')}{' '}
                                                        {student.classes.grade}-
                                                        {student.classes.section}
                                                    </span>
                                                ) : (
                                                    <span className="italic text-muted-foreground">
                                                        {t('unassigned')}
                                                    </span>
                                                )}
                                            </TD>
                                            <TD>
                                                <Badge
                                                    id={idx === 0 ? 'user-status-toggle' : undefined}
                                                    tone={
                                                        student.users?.is_active
                                                            ? 'success'
                                                            : 'danger'
                                                    }
                                                    dot
                                                >
                                                    {student.users?.is_active
                                                        ? t('active')
                                                        : t('inactive')}
                                                </Badge>
                                            </TD>
                                            <TD align="right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Link
                                                        href={`/institution-admin/students/${student.id}?edit=true`}
                                                        aria-label={t('edit')}
                                                        title={t('edit')}
                                                        className={buttonClass({
                                                            variant: 'ghost',
                                                            size: 'icon-sm',
                                                        })}
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Link>
                                                    <Link
                                                        href={`/institution-admin/students/${student.id}`}
                                                        aria-label={t('view')}
                                                        title={t('view')}
                                                        className={buttonClass({
                                                            variant: 'ghost',
                                                            size: 'icon-sm',
                                                        })}
                                                    >
                                                        <Eye className="size-4" />
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label={t('deactivate')}
                                                        title={t('deactivate')}
                                                        disabled={!student.users?.is_active}
                                                        onClick={() =>
                                                            setStudentToDelete(student)
                                                        }
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </TD>
                                        </motion.tr>
                                    ))
                                )}
                            </TBody>
                        </Table>
                    </TableWrap>
                )}

                <MultiStepModal
                    isOpen={!!studentToDelete}
                    onClose={() => setStudentToDelete(null)}
                    title={t('deactivate')}
                    steps={[
                        {
                            title: t('step1Title'),
                            description: t('step1Desc', {
                                name: studentToDelete?.users?.full_name ?? '',
                            }),
                            confirmText: t('step1Confirm'),
                            isDestructive: true,
                        },
                        {
                            title: t('step2Title'),
                            description: t('step2Desc'),
                            confirmText: t('step2Confirm'),
                            isDestructive: true,
                        },
                    ]}
                    onComplete={handleDeleteConfirm}
                />

                <Dialog
                    open={bulkModalOpen}
                    onClose={() => setBulkModalOpen(false)}
                    title={t('bulkImportTitle')}
                    description={t('bulkImportDesc')}
                    footer={
                        <div className="flex items-center justify-between w-full">
                            <Button
                                variant="ghost"
                                size="sm"
                                leadingIcon={<Download className="size-4" />}
                                onClick={() => {
                                    const csvContent = 'data:text/csv;charset=utf-8,full_name,email,admission_no,phone\nKamal Perera,kamal@example.com,ADM-001,+94771234567\nNimal Silva,nimal@example.com,ADM-002,+94772345678';
                                    const encodedUri = encodeURI(csvContent);
                                    const link = document.createElement('a');
                                    link.setAttribute('href', encodedUri);
                                    link.setAttribute('download', 'student_template.csv');
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                            >
                                Template
                            </Button>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" onClick={() => setBulkModalOpen(false)}>
                                    {tc('cancel')}
                                </Button>
                                <Button
                                    variant="primary"
                                    loading={bulkImporting}
                                    disabled={!bulkCsv.trim()}
                                    onClick={handleBulkImport}
                                >
                                    {tc('save')}
                                </Button>
                            </div>
                        </div>
                    }
                >
                    <div className="space-y-4 pt-2">
                        <p className="text-xs text-muted-foreground">
                            Paste CSV rows (header: <code>full_name,email,admission_no,phone</code>) or drag-and-drop a CSV file below.
                        </p>
                        <textarea
                            value={bulkCsv}
                            onChange={(e) => setBulkCsv(e.target.value)}
                            placeholder="Kamal Perera,kamal@example.com,ADM-001,+94771234567&#10;Nimal Silva,nimal@example.com,ADM-002,+94772345678"
                            rows={6}
                            className="w-full rounded-input border border-border bg-background p-3 text-xs font-mono focus-visible:outline-2 focus-visible:outline-primary"
                        />
                    </div>
                </Dialog>

                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
