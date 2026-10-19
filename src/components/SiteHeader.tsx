import ThemeToggle from "@/components/ThemeToggle";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-blue-600 shadow-sm">
            <svg
              className="h-4 w-4 text-black"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            videoBrief
            <span className="text-zinc-400 dark:text-zinc-500">.io</span>
          </span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
