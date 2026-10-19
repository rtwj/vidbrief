"use client";

function applyTheme(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  try {
    window.localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {
    // Storage can be unavailable (private mode); the toggle still works,
    // it just won't be remembered across visits.
  }
}

export default function ThemeToggle() {
  const toggle = () => {
    applyTheme(!document.documentElement.classList.contains("dark"));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle light / dark theme"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {/* Moon: shown in light mode to offer dark mode. */}
      <svg
        className="h-4 w-4 dark:hidden"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
        />
      </svg>
      {/* Sun: shown in dark mode to offer light mode. */}
      <svg
        className="hidden h-4 w-4 dark:block"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        />
      </svg>
    </button>
  );
}
