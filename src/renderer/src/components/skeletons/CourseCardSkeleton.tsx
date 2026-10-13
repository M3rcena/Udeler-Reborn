import React from 'react'

export const CourseCardSkeleton: React.FC = () => {
    return (
        <div className="relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg backdrop-blur-xl">
            {/* Thumbnail Shimmer */}
            <div className="relative aspect-video w-full overflow-hidden bg-[var(--bg-card)]">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <div className="absolute top-3 left-3 h-5 w-20 rounded-full bg-white/10" />
                <div className="absolute right-3 bottom-3 h-4 w-12 rounded-md bg-white/10" />
            </div>

            {/* Content Shimmer */}
            <div className="flex flex-1 flex-col justify-between p-4.5 gap-4">
                <div className="space-y-2.5">
                    {/* Title Lines */}
                    <div className="relative h-4 w-4/5 overflow-hidden rounded-md bg-white/10">
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                    </div>
                    <div className="relative h-4 w-3/5 overflow-hidden rounded-md bg-white/10">
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                    </div>

                    {/* Author */}
                    <div className="flex items-center gap-2 pt-1">
                        <div className="h-4 w-4 rounded-full bg-white/10" />
                        <div className="h-3 w-28 rounded-md bg-white/5" />
                    </div>
                </div>

                {/* Progress & Bottom Bar */}
                <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
                    <div className="flex items-center justify-between text-xs">
                        <div className="h-3 w-16 rounded-md bg-white/5" />
                        <div className="h-3 w-10 rounded-md bg-white/5" />
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10" />
                    <div className="flex gap-2 pt-1">
                        <div className="h-8 flex-1 rounded-xl bg-white/10" />
                        <div className="h-8 w-8 rounded-xl bg-white/10" />
                    </div>
                </div>
            </div>
        </div>
    )
}