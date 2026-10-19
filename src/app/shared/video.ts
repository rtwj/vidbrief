/**
 * Extracts the video id from a YouTube URL.
 *
 * Kept dependency-free so it can run both on the server and in the browser
 * (the client uses it to show the player before the summary is ready).
 */
export function extractVideoId(url: string): string | null {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname.includes("youtube.com")) {
      if (parsedUrl.pathname.startsWith("/watch")) {
        return parsedUrl.searchParams.get("v");
      }
      if (parsedUrl.pathname.startsWith("/embed/")) {
        return parsedUrl.pathname.split("/")[2];
      }
      if (parsedUrl.pathname.startsWith("/v/")) {
        return parsedUrl.pathname.split("/")[2];
      }
      if (parsedUrl.pathname.startsWith("/shorts/")) {
        return parsedUrl.pathname.split("/")[2];
      }
    }

    if (parsedUrl.hostname.includes("youtu.be")) {
      return parsedUrl.pathname.slice(1);
    }

    return null;
  } catch {
    return null;
  }
}
