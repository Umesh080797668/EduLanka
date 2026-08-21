'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { BookOpen, ChevronRight, FileEdit, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { HelpButton } from '@/components/HelpButton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { PageSkeleton } from '@/components/ui/Skeleton';

const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: any = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function TeacherClassesPage() {
    const t = useTranslations('TeacherClasses');
    const searchParams = useSearchParams();
    const query = searchParams?.get('query')?.toLowerCase() || '';

    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeacherClasses = async () => {
            try {
                // Classes are linked to the teacher's *user* id via class_teachers,
                // so resolve the signed-in user first.
                const user = await apiClient.get<any>('/users/me');
                if (user) {
                    const classesData = await apiClient.get<any>(
                        `/classes?teacherId=${user?.id}`,
                    );
                    setClasses(classesData || []);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchTeacherClasses();
    }, []);

    const filteredClasses = classes.filter(
        (cls) =>
            !query ||
            cls.section?.toLowerCase().includes(query) ||
            cls.grades?.level?.toString().includes(query) ||
            cls.year?.toString().includes(query),
    );

    return (
        <TutorialProvider role="TEACHER" screenId="classes">
            <div className="mx-auto max-w-5xl">
                <PageHeader
                    icon={<Users />}
                    title={t('myAssignedClasses')}
                    description={t('selectToViewRoster')}
                    badge={
                        !loading && classes.length > 0 ? (
                            <Badge tone="primary">{classes.length}</Badge>
                        ) : undefined
                    }
                />

                {loading ? (
                    <PageSkeleton rows={3} cols={3} />
                ) : filteredClasses.length === 0 ? (
                    <Card>
                        <EmptyState
                            icon={<BookOpen />}
                            title={
                                classes.length === 0
                                    ? t('noClassesAssigned')
                                    : t('noMatches')
                            }
                            description={
                                classes.length === 0
                                    ? t('notAssignedYet')
                                    : t('noMatchesDesc')
                            }
                        />
                    </Card>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {filteredClasses.map((cls) => (
                            <motion.div key={cls.id} variants={itemVariants}>
                                <Link
                                    href={`/teacher/classes/${cls.id}/grades`}
                                    className="block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                >
                                    <Card
                                        interactive
                                        flush
                                        className="group flex h-full flex-col"
                                    >
                                        <CardContent className="flex-1 pt-5">
                                            <span className="grid size-12 place-items-center rounded-card bg-primary-subtle text-primary">
                                                <BookOpen className="size-6" />
                                            </span>

                                            <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                                                {cls.grades?.level} {cls.section}
                                            </h3>
                                            <p className="mt-0.5 text-sm text-muted-foreground">
                                                {t('classYear')} {cls.year}
                                            </p>

                                            <div className="mt-4 flex items-center gap-2 rounded-input border border-border bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
                                                <Users className="size-4 shrink-0" />
                                                <span>
                                                    {typeof cls.students?.length === 'number'
                                                        ? t('studentsEnrolled', {
                                                            count: cls.students.length,
                                                        })
                                                        : t('rosterAvailable')}
                                                </span>
                                            </div>
                                        </CardContent>

                                        <CardFooter className="bg-muted/40">
                                            <span className="flex w-full items-center justify-center gap-2 rounded-input border border-border bg-card py-2.5 text-[13px] font-semibold text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary-subtle">
                                                <FileEdit className="size-4" />
                                                {t('enterGradesAction')}
                                                <ChevronRight className="size-4" />
                                            </span>
                                        </CardFooter>
                                    </Card>
                                </Link>
                            </motion.div>
                        ))}
                    </motion.div>
                )}

                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
