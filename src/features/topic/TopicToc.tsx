import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { scrollToAnchor } from './useActiveSection';

export interface TocItem {
  id: string;
  title: string;
  /** Optional count shown next to the title (e.g. number of questions). */
  count?: number;
}

const onAnchorClick = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let the browser open new tabs
  e.preventDefault();
  scrollToAnchor(id);
};

/** Desktop (xl+): sticky "On this page" list with a sliding active indicator. */
export function TocSidebar({ items, active }: { items: TocItem[]; active?: string }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    setIndicator(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
  }, [active, items]);

  return (
    <nav aria-label="On this page" className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] overflow-y-auto xl:block">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">On this page</h2>
      <ul ref={listRef} className="relative border-l border-line">
        {indicator && (
          <span
            aria-hidden="true"
            className="absolute -left-px w-0.5 rounded-full bg-accent transition-all duration-300 ease-(--ease-out-expo)"
            style={{ top: indicator.top, height: indicator.height }}
          />
        )}
        {items.map((item) => (
          <li key={item.id} data-id={item.id}>
            <a
              href={`#${item.id}`}
              onClick={onAnchorClick(item.id)}
              aria-current={item.id === active ? 'location' : undefined}
              className={`flex items-center justify-between gap-2 py-1.5 pr-2 pl-4 text-sm transition-colors duration-200 ${
                item.id === active ? 'font-medium text-accent-ink' : 'text-muted hover:text-fg'
              }`}
            >
              {item.title}
              {item.count !== undefined && <span className="text-xs tabular-nums">{item.count}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Below xl: sticky, horizontally scrollable chips under the header; the active chip stays in view. */
export function TocChips({ items, active }: { items: TocItem[]; active?: string }) {
  const scrollerRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const chip = scroller?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!scroller || !chip) return;
    const left = chip.offsetLeft - scroller.clientWidth / 2 + chip.offsetWidth / 2;
    scroller.scrollTo?.({ left, behavior: 'smooth' });
  }, [active]);

  return (
    <nav aria-label="On this page" className="sticky top-16 z-20 -mx-4 mb-2 border-b border-line bg-canvas sm:-mx-8 xl:hidden">
      <ul ref={scrollerRef} className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.id} data-id={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              onClick={onAnchorClick(item.id)}
              aria-current={item.id === active ? 'location' : undefined}
              className={`block rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors duration-200 ${
                item.id === active ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-fg-soft hover:border-accent'
              }`}
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Section heading with a hover/focus "#" link beside it (outside the <h2>, so the heading's name stays clean). */
export function SectionHeading({ id, title }: { id: string; title: string }) {
  return (
    <div className="group flex items-center gap-2 border-b border-line pb-2">
      <h2 id={`${id}-h`} className="text-2xl font-semibold tracking-tight text-fg">
        {title}
      </h2>
      <a
        href={`#${id}`}
        onClick={onAnchorClick(id)}
        aria-label={`Link to ${title}`}
        className="text-lg text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-accent-ink focus-visible:opacity-100"
      >
        #
      </a>
    </div>
  );
}
