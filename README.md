# YouTube Summarizer

Paste a YouTube link and get a structured, timestamped brief: section headings, bullet points, and clickable timestamps that jump the embedded player to the exact moment. The UI brand is **videoBrief.io**.

Built with Next.js 16 (App Router), React 19, and Tailwind CSS v4.

---

## Features

- **Timestamped summaries.** The transcript is fed to the model with `[MM:SS]` markers, so the summary cites real moments you can verify.
- **Clickable timestamps.** Clicking a timestamp seeks the embedded player to that second.
- **Structured output.** The prompt asks for an overview sentence, 3–6 `##` sections, and `- ` bullets with bolded key terms.
- **Live progress percentage.** The API streams progress events; 100% is only reported when the full result is ready.
- **Provider fallback.** Gemini first; if it is unavailable or out of quota, it falls back to a free OpenRouter model.
- **Embeddability detection.** If a video's owner disabled embedding, the player is replaced with a "Watch on YouTube" link.

---

## Quick start

```bash
npm install
```

Create `.env.local` with at least one provider key:

```bash
GOOGLE_API_KEY=...          # primary (Gemini)
OPENROUTER_API_KEY=...      # optional fallback (free models)
```

```bash
npm run dev
```

Open http://localhost:3000.

---

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GOOGLE_API_KEY` | one of these two | — | Gemini API key ([AI Studio](https://aistudio.google.com/apikey)) |
| `OPENROUTER_API_KEY` | one of these two | — | OpenRouter key, used as the fallback |
| `GEMINI_MODELS` | no | `gemini-3.8-flash` | Comma-separated Gemini models, tried in order |
| `OPENROUTER_MODELS` | no | `nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3-super-120b-a12b:free` | Comma-separated OpenRouter models, tried in order |
| `OPENROUTER_MAX_TOKENS` | no | `2048` | Output cap for OpenRouter calls |
| `OPENROUTER_TIMEOUT_MS` | no | `120000` | Total timeout for a streamed OpenRouter call |

The two provider keys are independent: the app runs Gemini-only or OpenRouter-only, and only errors with a 500 if neither is set.

Model ID lists ignore empty or whitespace-only values and fall back to the defaults, so `GEMINI_MODELS=` cannot silently produce an empty chain.

**Unused keys.** `.env.local` may also contain `HF_TOKEN`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `MISTRAL_API_KEY`. Nothing in the code reads them. They are leftovers from the earlier Hugging Face / BART implementation and can be deleted.

---

## How it works

```
POST /api/summarize
  1. Validate the URL, extract the video id
  2. oEmbed  -> video title + embeddability
  3. Fetch the transcript (youtube-transcript) with per-segment offsets
  4. Group segments into ~240-char blocks, prefix each with [MM:SS]
  5. Gemini (streaming) -> on failure, free OpenRouter model (streaming)
  6. Stream progress events, then a terminal "done" event with the result
```

The summary prompts are sent the **timestamped** transcript, which is what lets the model cite moments that actually exist. The plain transcript is returned separately for display.

### Provider chain

```
gemini-3.8-flash                              (primary)
    ↓ unavailable / quota exhausted / error
nvidia/nemotron-3-ultra-550b-a55b:free        (1M ctx)
    ↓
nvidia/nemotron-3-super-120b-a12b:free        (262k ctx)
```

Free OpenRouter models are reasoning-capable, which causes two issues that the code works around:

- Reasoning tokens count toward `max_tokens`, so a small cap can produce **empty content** with `finish_reason: length`. The request therefore sends `reasoning: { enabled: false }`, and retries once without the flag if a model rejects it with a 400.
- Reasoning makes these models slow and variable, so model ordering matters. Measured latency: `ultra` 1.2–3.7s, `super` 5–7s, `nemotron-3.5-lightning` 11–53s (dropped for being too slow), `gemma-4-31b-it:free` consistently 429.

### Progress reporting

The endpoint returns `application/x-ndjson`: one JSON object per line.

```
{"type":"progress","percent":25,"label":"Transcript ready"}
{"type":"progress","percent":57,"label":"Writing the summary"}
{"type":"done","percent":100,"result":{...}}
```

Stages before generation are real milestones with fixed weights (3 → 8 → 12 → 25). The generation share is an **estimate**:

- Gemini reasons server-side before emitting any text, so there is no signal for several seconds. Measured time-to-first-token is **8–12s**.
- The client therefore also advances a decaying time-based estimate and shows whichever is further along, capped at 99.
- **100% is only sent once the full result is assembled.** An error never reports 100%.

To reduce that dead zone for real, the fix is switching to the newer `@google/genai` SDK, which supports `thinkingConfig` so thinking can be disabled or bounded. `@google/generative-ai` 0.24 does not.

---

## API

### `POST /api/summarize`

Request:

```json
{ "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
```

Success: `200` with an `application/x-ndjson` stream. Each line is one of:

| Event | Shape |
| --- | --- |
| `progress` | `{ type, percent, label }` |
| `done` | `{ type, percent: 100, result: { summary, model, provider, transcript, videoTitle, videoId, embeddable } }` |
| `error` | `{ type, error }` |

Pre-flight failures return plain JSON instead:

| Status | Cause |
| --- | --- |
| `400` | Missing or unparseable `videoUrl` |
| `500` | Neither provider key is configured |

Failures that happen after streaming has begun (no transcript, all models unavailable) arrive as in-stream `error` events, because the response status has already been sent.

### `GET /api/health`

```json
{ "status": "ok" }
```

---

## Project structure

```
src/
├── app/
│   ├── api/summarize/route.ts   Streaming NDJSON endpoint, provider chain, prompt
│   ├── api/health/route.ts      Health check
│   ├── globals.css              Tailwind import, theme tokens, scrollbars
│   ├── layout.tsx               Fonts (Geist), no-flash theme script, metadata
│   └── page.tsx                 Client orchestrator: stream reader, progress, seek
├── components/
│   ├── SiteHeader.tsx           Sticky header: logo, brand, theme toggle
│   ├── ThemeToggle.tsx          Light/dark toggle (class on <html>, persisted)
│   ├── SearchBar.tsx            URL input + inline button + spinner/percentage
│   ├── LoadingResults.tsx       Transcript/summary skeletons, progress bar
│   ├── VideoPanel.tsx           Embedded player, embeddability fallback
│   ├── TranscriptPanel.tsx      Scrollable transcript
│   ├── SummaryPanel.tsx         Summary card and provenance footer
│   └── SummaryContent.tsx       Markdown renderer with clickable timestamps
└── lib/
    ├── youtube.ts               Transcript fetch, timestamped blocks
    ├── video.ts                 YouTube URL -> video id (shared client/server)
    └── time.ts                  MM:SS formatting/parsing, watch URLs
```

No extra dependencies were added for Markdown rendering: `SummaryContent.tsx` is a small, tolerant parser for headings, bullets, ordered lists, bold, code, and timestamps. It degrades to paragraphs if a model ignores the format.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

> Next.js 16 no longer runs the linter during `next build`, so run `npm run lint` explicitly.

---

## Known limitations

- **The generation percentage is an estimate**, for the reason described above. Only milestones and 100% are exact.
- **Free-tier quotas.** OpenRouter free models have daily caps. On a heavy day both fallbacks can return 429 and you get an in-stream error with the reason in the server log.
- **Video ID defaults drift.** Hardcoded model IDs eventually get deprecated (for example `gemini-2.5-flash-lite` is already gone, and `gemini-3.5-flash`/`gemini-3.7-flash` now silently resolve to newer versions). Expect to revisit the defaults periodically.
- **Timestamps are only as good as the transcript.** Auto-generated captions may be inaccurate, and the model can only cite block starts, not arbitrary seconds.
- **Seeking requires a browser.** The click-to-seek path uses the YouTube IFrame API over `postMessage`; it has not been verified with an automated browser test.
- **Long videos** are sent to the model in a single request. There is no chunking, so an extremely long transcript could exceed a model's context window.
- **Unused dependencies.** `@ai-sdk/*`, `ai`, and `@huggingface/inference` remain in `package.json` but are not imported anywhere.
