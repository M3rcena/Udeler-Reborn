import React from 'react'
import { CourseCardSkeleton } from './CourseCardSkeleton'

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="flex flex-1 flex-col gap-6 overflow-hidden p-8">
            {/* Top Filter Bar Skeleton */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 w-24 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse" />
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-8 w-32 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse" />
                    <div className="h-8 w-28 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse" />
                </div>
            </div>

            {/* Grid of Ghost Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 overflow-y-auto pr-1">
                {Array.from({ length: 8 }).map((_, index) => (
                    <CourseCardSkeleton key={index} />
                ))}
            </div>
        </div>
    )
}