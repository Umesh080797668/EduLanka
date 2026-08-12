import React from 'react';

export function Skeleton({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`animate-pulse rounded-md bg-slate-200 ${className}`}
            {...props}
        />
    );
}

export function PageSkeleton() {
    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center mb-6">
                <Skeleton className="h-8 w-1/3 rounded-lg" />
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-5">
                {/* Header Row */}
                <div className="flex border-b border-slate-100 pb-4">
                    <Skeleton className="h-5 w-1/4 mr-4" />
                    <Skeleton className="h-5 w-1/4 mr-4" />
                    <Skeleton className="h-5 w-1/4 mr-4" />
                    <Skeleton className="h-5 w-1/4" />
                </div>
                
                {/* Data Rows */}
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex py-3">
                        <Skeleton className="h-4 w-1/4 mr-4" />
                        <Skeleton className="h-4 w-1/4 mr-4" />
                        <Skeleton className="h-4 w-1/4 mr-4" />
                        <Skeleton className="h-4 w-1/4" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function DashboardCardsSkeleton() {
    return (
        <div className="w-full space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Skeleton className="h-32 w-full rounded-2xl bg-white border border-slate-100" />
                <Skeleton className="h-32 w-full rounded-2xl bg-white border border-slate-100" />
                <Skeleton className="h-32 w-full rounded-2xl bg-white border border-slate-100" />
            </div>
            <Skeleton className="h-48 w-full rounded-2xl bg-white border border-slate-100" />
        </div>
    );
}
