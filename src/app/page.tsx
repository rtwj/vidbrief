"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SummarySkeleton, TranscriptSkeleton } from "@/components/LoadingResults";
import SearchBar from "@/components/SearchBar";
import SiteHeader from "@/components/SiteHeader";
import SummaryPanel from "@/components/SummaryPanel";
import TranscriptPanel from "@/components/TranscriptPanel";
import VideoPanel from "@/components/VideoPanel";
import { extractVideoId } from "@/lib/video";

interface SummaryResponse {
  summary: string;
  transcript: string;
  videoTitle: string;
  videoId: string;
  embeddable: boolean;
  model: string;
  provider: string;
}

interface PendingVideo {
  videoId: string;
  title: string;
  embeddable: boolean;
}

interface ProgressState {
  percent: number;
  label: string;
}

const EXAMPLES = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ",
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<SummaryResponse | null>(null);
  // Set as soon as a submission starts, from the URL alone: the player is
  // independent of the summary, so it can appear before generation finishes.
  const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    percent: 0,
    label: "Starting",
  });
  const [crawlPercent, setCrawlPercent] = useState(0);
  const [error, setError] = useState("");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const generationStartRef = useRef<number | null>(null);
  const scrolledToResultsRef = useRef(false);

  // The model reports no signal while it is thinking (Gemini reasons
  // server-side before emitting any text), which leaves the bar frozen for
  // several seconds. So during generation we advance an *estimated* crawl on a
  // decaying curve, and show whichever is further along. It is capped below
  // 100: only a real completion event is allowed to reach 100%.
  useEffect(() => {
    if (!loading) return;

    const id = window.setInterval(() => {
      const startedAt = generationStartRef.current;
      if (startedAt === null) return;

      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      const ratio = 1 - Math.exp(-elapsedSeconds / 8);
      setCrawlPercent(Math.min(95, 25 + ratio * 70));
    }, 400);

    return () => window.clearInterval(id);
  }, [loading]);

  const displayPercent = loading
    ? Math.min(99, Math.max(progress.percent, Math.round(crawlPercent)))
    : progress.percent;

  // Scroll the results into view once generation finishes, so the brief is
  // revealed by scrolling rather than by navigating away. The player is shown
  // as soon as a submission starts, so scroll to it then too.
  useEffect(() => {
    if (!resultsRef.current) return;

    if (loading && pendingVideo && !scrolledToResultsRef.current) {
      scrolledToResultsRef.current = true;
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (!loading && result) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading, result, pendingVideo]);

  const handleSubmit = useCallback(async (submittedUrl: string) => {
    if (!submittedUrl.trim()) return;

    // Show the player straight away from the URL. It is separate from the
    // summary, so it does not need to wait for generation to finish.
    const videoId = extractVideoId(submittedUrl);
    scrolledToResultsRef.current = false;
    setPendingVideo(
      videoId ? { videoId, title: "", embeddable: true } : null
    );

    setLoading(true);
    setError("");
    setResult(null);
    setProgress({ percent: 0, label: "Starting" });
    setCrawlPercent(0);
    generationStartRef.current = null;

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: submittedUrl }),
      });

      // Pre-flight failures (bad URL, missing provider) are plain JSON.
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error || "Something went wrong. Please try again.");
        setPendingVideo(null);
        return;
      }

      if (!response.body) {
        const data = await response.json();
        setResult(data);
        setPendingVideo(null);
        setProgress({ percent: 100, label: "Done" });
        return;
      }

      // The response is newline-delimited JSON: progress events, then either a
      // terminal "done" event with the result or an "error" event.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          let event: {
            type?: string;
            percent?: number;
            label?: string;
            error?: string;
            result?: SummaryResponse;
            videoId?: string;
            videoTitle?: string;
            embeddable?: boolean;
          };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === "progress") {
            const percent = event.percent ?? 0;

            // Generation begins once the transcript milestone is reported.
            if (percent >= 25 && generationStartRef.current === null) {
              generationStartRef.current = Date.now();
            }

            setProgress({
              percent,
              label: event.label ?? "Working",
            });
          } else if (event.type === "meta") {
            // Enrich the early player with the real title and embeddability.
            setPendingVideo((prev) => {
              const id = event.videoId ?? prev?.videoId;
              if (!id) return prev;
              return {
                videoId: id,
                title: event.videoTitle ?? prev?.title ?? "",
                embeddable: event.embeddable ?? prev?.embeddable ?? true,
              };
            });
          } else if (event.type === "done" && event.result) {
            setResult(event.result);
            setPendingVideo(null);
            setProgress({ percent: 100, label: "Done" });
            finished = true;
          } else if (event.type === "error") {
            setError(event.error || "Something went wrong. Please try again.");
            setPendingVideo(null);
            finished = true;
          }
        }
      }

      if (!finished) {
        setError("The connection closed before the summary finished.");
        setPendingVideo(null);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setPendingVideo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Seek the embedded player via the IFrame API's postMessage command channel.
  const handleSeek = useCallback((seconds: number) => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) return;

    frame.contentWindow.postMessage(
      JSON.stringify({
        event: "command",
        func: "seekTo",
        args: [seconds, true],
      }),
      "https://www.youtube.com"
    );
  }, []);

  // The player is driven by the result once it exists, otherwise by the
  // optimistic video derived from the submitted URL.
  const activeVideo = result
    ? {
        videoId: result.videoId,
        title: result.videoTitle,
        embeddable: result.embeddable,
      }
    : pendingVideo;

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Turn any YouTube video into a brief you can verify
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-400">
            Paste a link and get a structured summary with section headings,
            bullet points, and clickable timestamps that jump the video to the
            exact moment.
          </p>
        </section>

        <div className="mx-auto mt-8 max-w-3xl">
          <SearchBar
            url={url}
            onUrlChange={setUrl}
            onSubmit={() => handleSubmit(url)}
            loading={loading}
            progress={displayPercent}
          />

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Try an example:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={loading}
                onClick={() => {
                  setUrl(example);
                  void handleSubmit(example);
                }}
                className="rounded-full border border-zinc-200 px-2.5 py-1 font-mono text-[11px] transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-50 dark:border-zinc-800 dark:hover:border-blue-500/50 dark:hover:text-blue-400"
              >
                {example.replace("https://www.", "").replace("https://", "")}
              </button>
            ))}
          </div>
        </div>

        <div ref={resultsRef} className="mt-10 scroll-mt-20">
          {error && (
            <div
              role="alert"
              className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
            >
              <svg
                className="mt-0.5 h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {activeVideo && (
            <div className="grid items-start gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <VideoPanel
                  videoId={activeVideo.videoId}
                  title={activeVideo.title}
                  embeddable={activeVideo.embeddable}
                  iframeRef={iframeRef}
                />
                {result ? (
                  <TranscriptPanel transcript={result.transcript} />
                ) : (
                  <TranscriptSkeleton />
                )}
              </div>

              {result ? (
                <SummaryPanel
                  summary={result.summary}
                  model={result.model}
                  provider={result.provider}
                  onSeek={result.embeddable ? handleSeek : () => {}}
                />
              ) : (
                <SummarySkeleton
                  percent={displayPercent}
                  label={progress.label}
                />
              )}
            </div>
          )}

          {!activeVideo && !loading && !error && (
            <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-800">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Your summary will appear here.
              </p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                Video briefing · full transcript · clickable timestamps
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
