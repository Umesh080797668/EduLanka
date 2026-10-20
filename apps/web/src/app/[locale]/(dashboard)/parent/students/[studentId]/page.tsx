'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { Spinner } from '@/components/ui/Spinner';

export default function StudentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const studentId = params?.studentId as string;

    useEffect(() => {
        if (studentId) {
            router.replace(`/parent/students/${studentId}/grades`);
        }
    }, [studentId, router]);

    return (
        <div className="flex min-h-[300px] items-center justify-center">
            <Spinner />
        </div>
    );
}
