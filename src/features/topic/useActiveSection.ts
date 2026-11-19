import { useEffect, useState } from 'react';

/**
 * Scroll-spy: the id of the first section (in document order) inside the reading band
 * just below the sticky header. At the very bottom of the page the last section wins,
 * so short final sections still get highlighted.
 */
export function useActiveSection(ids: string[], topOffset = 128): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  const key = ids.join('|');

  useEffect(() => {
    if (ids.length === 0 || !('IntersectionObserver' in window)) return;
    const visible = new Map<string, boolean>();

    const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const update = () => {
      if (atBottom()) return setActive(ids.at(-1));
      const first = ids.find((id) => visible.get(id));
      if (first) setActive(first);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        update();
      },
      { rootMargin: `-${topOffset}px 0px -55% 0px` },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
    };
  }, [key, topOffset]); // `key` stands in for `ids`

  return active;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Smoothly scroll to an in-page anchor and reflect it in the URL without a router navigation. */
export function scrollToAnchor(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(history.state, '', `#${id}`);
}
