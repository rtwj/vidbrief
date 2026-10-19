"use client";

export default function TranscriptPanel({ transcript }: { transcript: string }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <svg
            className="h-4 w-4 text-zinc-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 10h16M4 14h10M4 18h7"
            />
          </svg>
          Transcript
        </h2>
        <span className="shrink-0 font-mono text-xs text-zinc-400">
          {transcript.split(/\s+/).filter(Boolean).length.toLocaleString()} words
        </span>
      </header>
      <div className="h-72 overflow-y-auto px-4 py-3 lg:h-80">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {transcript}
        </p>
      </div>
    </section>
  );
}
