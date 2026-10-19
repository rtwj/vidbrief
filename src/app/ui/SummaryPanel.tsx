"use client";

import SummaryContent, { type SeekHandler } from "@/app/ui/SummaryContent";

function providerLabel(provider: string): string {
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "gemini") return "Gemini";
  return provider;
}

export default function SummaryPanel({
  summary,
  model,
  provider,
  onSeek,
}: {
  summary: string;
  model: string;
  provider: string;
  onSeek: SeekHandler;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="border-b border-zinc-100 bg-gradient-to-r from-blue-50/70 to-transparent px-5 py-4 dark:border-zinc-800 dark:from-blue-500/5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 12l4 4L19 6"
              />
            </svg>
          </span>
          Summary
        </h2>
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Generated with <span className="font-mono">{model}</span> via{" "}
          <span className="font-mono">{providerLabel(provider)}</span>
          {" · "}
          <span title="Click a timestamp to jump the video to that moment">
            timestamps are clickable
          </span>
        </p>
      </header>

      <div className="px-5 py-5">
        <SummaryContent markdown={summary} onSeek={onSeek} />
      </div>
    </section>
  );
}
