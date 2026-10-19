"use client";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export default function SearchBar({
  url,
  onUrlChange,
  onSubmit,
  loading,
  progress,
}: {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  progress: number;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex items-stretch gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
            />
          </svg>
        </span>
        <label htmlFor="video-url" className="sr-only">
          YouTube video URL
        </label>
        <input
          id="video-url"
          type="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="Paste a YouTube URL, e.g. https://youtube.com/watch?v=…"
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full rounded-xl border-0 bg-transparent pl-9 pr-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:text-zinc-100"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !url.trim()}
        aria-live="polite"
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:from-blue-600 hover:to-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900"
      >
        {loading ? (
          <>
            <Spinner />
            <span className="tabular-nums">Summarizing… {progress}%</span>
          </>
        ) : (
          "Summarize"
        )}
      </button>
    </form>
  );
}
