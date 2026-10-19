"use client";

import type { ReactNode } from "react";
import { parseTimestamp } from "@/app/shared/time";

export type SeekHandler = (seconds: number) => void;

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "bullet"; text: string; ordered: boolean }
  | { type: "paragraph"; text: string };

const INLINE_TOKEN =
  /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[\d{1,2}:\d{2}(?::\d{2})?\]|\(\d{1,2}:\d{2}(?::\d{2})?\))/g;

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || /^([-*_])\1{2,}$/.test(line)) continue;

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      blocks.push({ type: "bullet", ordered: false, text: bullet[1].trim() });
      continue;
    }

    const ordered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      blocks.push({ type: "bullet", ordered: true, text: ordered[1].trim() });
      continue;
    }

    const previous = blocks[blocks.length - 1];
    if (previous && previous.type === "paragraph") {
      previous.text = `${previous.text} ${line}`;
    } else {
      blocks.push({ type: "paragraph", text: line });
    }
  }

  return blocks;
}

function renderInline(
  text: string,
  onSeek: SeekHandler,
  keyPrefix: string
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of text.matchAll(INLINE_TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(text.slice(cursor, index));

    const token = match[0];
    const tokenKey = `${keyPrefix}-${key++}`;

    if (token.startsWith("**")) {
      nodes.push(
        <strong
          key={tokenKey}
          className="font-semibold text-zinc-900 dark:text-zinc-50"
        >
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={tokenKey}
          className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const label = token.startsWith("[") || token.startsWith("(")
        ? token.slice(1, -1)
        : token;
      const seconds = parseTimestamp(label);

      if (seconds === null) {
        nodes.push(token);
      } else {
        nodes.push(
          <button
            key={tokenKey}
            type="button"
            onClick={() => onSeek(seconds)}
            title={`Jump to ${label} in the video`}
            className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 align-baseline font-mono text-[0.78em] font-medium text-blue-700 transition-colors hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
          >
            <svg
              className="h-2.5 w-2.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            {label}
          </button>
        );
      }
    }

    cursor = index + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));

  return nodes;
}

export default function SummaryContent({
  markdown,
  onSeek,
}: {
  markdown: string;
  onSeek: SeekHandler;
}) {
  const blocks = parseBlocks(markdown);
  const rendered: ReactNode[] = [];
  let list: { text: string; ordered: boolean }[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length === 0) return;
    const ordered = list[0].ordered;
    const items = list.map((item, index) => (
      <li key={index} className="flex gap-2.5">
        <span
          aria-hidden="true"
          className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500/70"
        />
        <span>{renderInline(item.text, onSeek, `li-${key}-${index}`)}</span>
      </li>
    ));
    rendered.push(
      ordered ? (
        <ol key={`list-${key++}`} className="space-y-2">
          {items}
        </ol>
      ) : (
        <ul key={`list-${key++}`} className="space-y-2">
          {items}
        </ul>
      )
    );
    list = [];
  };

  for (const block of blocks) {
    if (block.type === "bullet") {
      list.push({ text: block.text, ordered: block.ordered });
      continue;
    }

    flushList();

    if (block.type === "heading") {
      rendered.push(
        <h3
          key={`h-${key++}`}
          className={
            block.level <= 2
              ? "text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
              : "text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-200"
          }
        >
          {renderInline(block.text, onSeek, `h-${key}`)}
        </h3>
      );
      continue;
    }

    rendered.push(
      <p
        key={`p-${key++}`}
        className="leading-relaxed text-zinc-700 dark:text-zinc-300"
      >
        {renderInline(block.text, onSeek, `p-${key}`)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-4 text-sm">{rendered}</div>;
}
