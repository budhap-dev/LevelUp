/**
 * LevelUp mark: a ground line with two chevrons rising from it.
 * Same geometry as public/favicon.svg; here it takes the active theme's accent colour.
 */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`logo-mark ${className}`}>
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <g fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="stroke-on-accent">
        <path className="logo-chevron logo-chevron-1" d="M10 14 16 8l6 6" />
        <path className="logo-chevron logo-chevron-2" d="M10 20.5 16 14.5l6 6" />
        <path d="M10 25h12" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-lg leading-none font-bold tracking-tight text-fg">
        Level<span className="text-accent-ink">Up</span>
        <span className="ml-1.5 hidden font-medium text-muted sm:inline">Engineer</span>
      </span>
    </span>
  );
}
