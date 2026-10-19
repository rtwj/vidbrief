"use client";

import { Spinner } from "@/components/SearchBar";

function SkeletonCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </section>
  );
}

/** Placeholder shown while the transcript is being fetched. */
export function TranscriptSkeleton() {
  return (
    <SkeletonCard>
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div className="h-4 w-28 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="h-72 space-y-2.5 px-4 py-4 lg:h-80">
        {Array.from({ length: 9 }).map((_, index) => (
          <div
            key={index}
            className="h-3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"
            style={{ width: `${70 + ((index * 13) % 30)}%` }}
          />
        ))}
      </div>
    </SkeletonCard>
  );
}

/** Placeholder shown while the summary is being generated. */
export function SummarySkeleton({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  return (
    <SkeletonCard>
      <div
        className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Spinner className="h-4 w-4 shrink-0 text-blue-500" />
            <span className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
              {label}
            </span>
          </div>
          <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
            {percent}%
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Summary progress"
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <div className="space-y-5 px-5 py-5">
        {[0, 1, 2].map((section) => (
          <div key={section} className="space-y-2.5">
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-700/70" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"
                style={{ width: `${62 + ((index * 17 + section * 7) % 32)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}
