const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
export const SHORTCUT_LABEL = isMac ? '⌘K' : 'Ctrl K';

export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search"
      aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
      className="flex h-10 items-center gap-2 rounded-lg text-muted transition-colors hover:text-fg max-sm:w-10 max-sm:justify-center max-sm:hover:bg-subtle sm:w-56 sm:border sm:border-line sm:bg-canvas sm:px-3 sm:hover:border-accent lg:w-72"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 sm:size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <span className="hidden flex-1 text-left text-sm sm:block">Search…</span>
      <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 font-sans text-xs sm:block">{SHORTCUT_LABEL}</kbd>
    </button>
  );
}
