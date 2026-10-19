import { YoutubeTranscript } from "youtube-transcript";
import { formatTimestamp } from "@/app/shared/time";

export interface TranscriptSegment {
  /** Start offset in seconds. */
  start: number;
  text: string;
}

export interface Transcript {
  /** Plain, readable transcript used for display. */
  text: string;
  /** Timestamped segments used to build the model prompt. */
  segments: TranscriptSegment[];
}

export async function fetchTranscript(
  videoId: string,
  languages: string[] = ["en"]
): Promise<Transcript> {
  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: languages.join(","),
    });

    if (!raw || raw.length === 0) {
      throw new Error("No transcript available for this video");
    }

    const segments: TranscriptSegment[] = raw
      .map((item) => ({
        start: Math.max(0, Math.round((item.offset ?? 0) / 1000)),
        text: item.text.replace(/\s+/g, " ").trim(),
      }))
      .filter((segment) => segment.text.length > 0);

    if (segments.length === 0) {
      throw new Error("No transcript available for this video");
    }

    return {
      text: segments.map((segment) => segment.text).join(" "),
      segments,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to fetch transcript"
    );
  }
}

/**
 * Groups segments into blocks and prefixes each with a [MM:SS] marker, so the
 * model can cite timestamps that genuinely exist in the transcript.
 */
export function buildTimestampedTranscript(
  segments: TranscriptSegment[],
  maxCharsPerBlock = 240
): string {
  if (segments.length === 0) return "";

  const lines: string[] = [];
  let blockStart = segments[0].start;
  let parts: string[] = [];
  let length = 0;

  for (const segment of segments) {
    if (parts.length > 0 && length + segment.text.length > maxCharsPerBlock) {
      lines.push(`[${formatTimestamp(blockStart)}] ${parts.join(" ")}`);
      parts = [];
      length = 0;
      blockStart = segment.start;
    }

    parts.push(segment.text);
    length += segment.text.length + 1;
  }

  if (parts.length > 0) {
    lines.push(`[${formatTimestamp(blockStart)}] ${parts.join(" ")}`);
  }

  return lines.join("\n");
}
