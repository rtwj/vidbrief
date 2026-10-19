"use client";

import type { RefObject } from "react";
import { youtubeWatchUrl } from "@/lib/time";

export default function VideoPanel({
  videoId,
  title,
  embeddable,
  iframeRef,
}: {
  videoId: string;
  title: string;
  embeddable: boolean;
  iframeRef: RefObject<HTMLIFrameElement | null>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="aspect-video w-full bg-black">
        {embeddable ? (
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1`}
            title={title || "YouTube video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-zinc-300">
              The owner disabled embedding for this video.
            </p>
            <a
              href={youtubeWatchUrl(videoId)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/20"
            >
              Watch on YouTube ↗
            </a>
          </div>
        )}
      </div>
      {title && (
        <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h2 className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
        </div>
      )}
    </section>
  );
}
