export function formatTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/** Parses "MM:SS" or "H:MM:SS" into seconds. Returns null if it isn't a timestamp. */
export function parseTimestamp(value: string): number | null {
  const parts = value.split(":");
  if (parts.length < 2 || parts.length > 3) return null;

  const numbers = parts.map((part) => (part.trim() === "" ? NaN : Number(part)));
  if (numbers.some((n) => Number.isNaN(n) || n < 0)) return null;

  if (numbers.length === 2) {
    const [minutes, seconds] = numbers;
    if (seconds >= 60) return null;
    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = numbers;
  if (minutes >= 60 || seconds >= 60) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function youtubeWatchUrl(videoId: string, seconds?: number): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return seconds === undefined ? base : `${base}&t=${Math.max(0, Math.floor(seconds))}s`;
}
