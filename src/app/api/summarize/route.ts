import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractVideoId } from "@/lib/video";
import {
  buildTimestampedTranscript,
  fetchTranscript,
  type Transcript,
} from "@/lib/youtube";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Generous cap for a summary; free models count hidden reasoning tokens here,
// so keep it well above the expected output length.
const OPENROUTER_MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS) || 2048;
// Streamed responses trickle in, so this guards total duration rather than
// time-to-first-byte. Free models can hang, but we still need an escape hatch.
const OPENROUTER_TIMEOUT_MS =
  Number(process.env.OPENROUTER_TIMEOUT_MS) || 120_000;

// ---------------------------------------------------------------------------
// Progress model
// ---------------------------------------------------------------------------
// Progress is reported as a percentage so the UI can show a determinate bar.
// The stages before generation are known milestones and get fixed weights.
// Generation itself is a single streamed request whose total length is not
// known in advance, so the share of the bar it occupies is *estimated* from the
// number of characters received, on a curve that never quite reaches the top.
// 100% is only ever sent once the full result is assembled and ready.
const STAGE = {
  validating: 3,
  metadata: 8,
  transcriptStart: 12,
  transcriptReady: 25,
  generationCeiling: 99,
} as const;

const GENERATION_WEIGHT = STAGE.generationCeiling - STAGE.transcriptReady;
const GENERATION_CHAR_SCALE = 700;

function generationPercent(chars: number): number {
  const ratio = 1 - Math.exp(-chars / GENERATION_CHAR_SCALE);
  return Math.min(STAGE.generationCeiling, STAGE.transcriptReady + ratio * GENERATION_WEIGHT);
}

type ProgressReporter = {
  report: (percent: number, label: string) => void;
  chars: (count: number, label: string) => void;
};

function createReporter(send: (payload: unknown) => void): ProgressReporter {
  let lastSent = -1;

  return {
    report(percent, label) {
      const rounded = Math.max(0, Math.min(100, Math.round(percent)));
      if (rounded <= lastSent) return;
      lastSent = rounded;
      send({ type: "progress", percent: rounded, label });
    },
    chars(count, label) {
      this.report(generationPercent(count), label);
    },
  };
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------
function parseModelList(raw: string | undefined, fallback: string): string[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback.split(",");
}

// Models are tried in order; the first one that returns a summary wins.
const GEMINI_MODELS = parseModelList(
  process.env.GEMINI_MODELS,
  "gemini-3.8-flash"
);
const OPENROUTER_MODELS = parseModelList(
  process.env.OPENROUTER_MODELS,
  "nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3-super-120b-a12b:free"
);

type SummaryResult = {
  summary: string;
  model: string;
  provider: "gemini" | "openrouter";
};

type ChunkHandler = (charsSoFar: number) => void;

function buildPrompt(timestampedTranscript: string): string {
  return [
    "You summarize YouTube videos for a reader who will verify claims in the video player.",
    "",
    "The transcript below is prefixed with [MM:SS] timestamps showing when each block begins.",
    "",
    "Write the summary in Markdown, following this structure exactly:",
    "- Start with one short overview sentence. No heading, no preamble.",
    '- Then 3-6 sections. Each section begins with a "## " heading naming its theme.',
    '- Under each heading, use "- " bullets. One or two sentences per bullet.',
    "- End a bullet with a timestamp in square brackets such as [04:12] when it maps to a",
    "  specific moment, copying the timestamp from the transcript.",
    "- Bold key terms with **double asterisks**.",
    "- Only use timestamps that appear in the transcript. Never invent or estimate one.",
    '- Never write phrases like "Here is a summary" or "In this video".',
    "",
    "Transcript:",
    timestampedTranscript,
  ].join("\n");
}

async function summarizeWithGemini(
  prompt: string,
  onChunk: ChunkHandler
): Promise<SummaryResult | null> {
  if (!GOOGLE_API_KEY) return null;

  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

  for (const modelId of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelId });
      const streamed = await model.generateContentStream(prompt);

      let chars = 0;
      for await (const chunk of streamed.stream) {
        try {
          chars += chunk.text().length;
        } catch {
          // Chunks without text parts (e.g. safety metadata) are not progress.
        }
        onChunk(chars);
      }

      const summary = (await streamed.response).text().trim();
      if (summary) return { summary, model: modelId, provider: "gemini" };

      console.warn(`[summarize] gemini "${modelId}" returned an empty summary`);
    } catch (e) {
      console.error(
        `[summarize] gemini "${modelId}" failed:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  return null;
}

async function summarizeWithOpenRouter(
  prompt: string,
  onChunk: ChunkHandler
): Promise<SummaryResult | null> {
  if (!OPENROUTER_API_KEY) return null;

  // Reasoning models can spend the entire token budget on hidden reasoning and
  // return empty content, so we ask for reasoning to be disabled by default.
  // Models that don't understand the flag reject it with a 400, in which case
  // we retry the same model once without it.
  const callModel = (modelId: string, disableReasoning: boolean) => {
    const payload: Record<string, unknown> = {
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      max_tokens: OPENROUTER_MAX_TOKENS,
      stream: true,
    };
    if (disableReasoning) payload.reasoning = { enabled: false };

    return fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
    });
  };

  for (const modelId of OPENROUTER_MODELS) {
    try {
      let response = await callModel(modelId, true);

      if (response.status === 400) {
        const detail = (await response.text()).slice(0, 200);
        console.warn(
          `[summarize] openrouter "${modelId}" rejected the reasoning flag, retrying without it: ${detail}`
        );
        response = await callModel(modelId, false);
      }

      if (!response.ok || !response.body) {
        const detail = response.body
          ? (await response.text()).slice(0, 200)
          : "(no body)";
        console.error(
          `[summarize] openrouter "${modelId}" failed: ${response.status} ${detail}`
        );
        continue;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let summary = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed?.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              summary += delta;
              onChunk(summary.length);
            }
          } catch {
            // Keep-alive comments and partial frames are not errors.
          }
        }
      }

      summary = summary.trim();
      if (summary) return { summary, model: modelId, provider: "openrouter" };

      console.warn(`[summarize] openrouter "${modelId}" returned an empty summary`);
    } catch (e) {
      console.error(
        `[summarize] openrouter "${modelId}" failed:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  return null;
}

// Gemini first; if it is unavailable or out of requests, fall back to a free
// OpenRouter model.
async function summarize(
  prompt: string,
  onChunk: ChunkHandler
): Promise<SummaryResult | null> {
  const geminiResult = await summarizeWithGemini(prompt, onChunk);
  if (geminiResult) return geminiResult;

  if (!OPENROUTER_API_KEY) {
    console.warn(
      "[summarize] gemini unavailable and OPENROUTER_API_KEY is not set"
    );
    return null;
  }

  console.warn("[summarize] gemini unavailable, falling back to OpenRouter");
  return summarizeWithOpenRouter(prompt, onChunk);
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!GOOGLE_API_KEY && !OPENROUTER_API_KEY) {
    return NextResponse.json(
      {
        error:
          "No AI provider configured. Set GOOGLE_API_KEY or OPENROUTER_API_KEY in environment variables.",
      },
      { status: 500 }
    );
  }

  let videoUrl: unknown;
  try {
    ({ videoUrl } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!videoUrl || typeof videoUrl !== "string") {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        } catch {
          closed = true;
        }
      };

      const progress = createReporter(send);

      try {
        progress.report(STAGE.validating, "Checking the link");

        // oEmbed gives us the title, and doubles as an embeddability check:
        // YouTube refuses it for videos whose owner disabled embedding.
        let videoTitle = "";
        let embeddable = true;
        try {
          const oembedResponse = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
          );
          if (oembedResponse.ok) {
            const oembedData = await oembedResponse.json();
            videoTitle = oembedData.title || "";
          } else {
            embeddable = false;
          }
        } catch (titleError) {
          console.warn("Failed to fetch video title:", titleError);
          embeddable = false;
        }
        progress.report(STAGE.metadata, "Fetched video details");

        // Send the video details as soon as they are known so the client can
        // render the player immediately, independent of the summary.
        send({ type: "meta", videoId, videoTitle, embeddable });

        progress.report(STAGE.transcriptStart, "Fetching the transcript");
        let transcript: Transcript;
        try {
          transcript = await fetchTranscript(videoId);
        } catch {
          send({
            type: "error",
            error: "No transcript available for this video",
          });
          return;
        }
        progress.report(STAGE.transcriptReady, "Transcript ready");

        const prompt = buildPrompt(buildTimestampedTranscript(transcript.segments));
        const result = await summarize(prompt, (chars) =>
          progress.chars(chars, "Writing the summary")
        );

        if (!result) {
          send({
            type: "error",
            error: "Summarization failed. All configured models were unavailable.",
          });
          return;
        }

        send({
          type: "done",
          percent: 100,
          result: {
            summary: result.summary,
            model: result.model,
            provider: result.provider,
            transcript: transcript.text,
            videoTitle,
            videoId,
            embeddable,
          },
        });
      } catch (error) {
        console.error("Unexpected error:", error);
        send({
          type: "error",
          error: "An unexpected error occurred. Please try again later.",
        });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
    cancel() {
      // The client navigated away or aborted; stop enqueueing.
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
