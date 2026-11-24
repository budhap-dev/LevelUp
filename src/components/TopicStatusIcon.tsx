import type { TopicState } from '@/lib/progress/types';

export const STATE_LABEL: Record<TopicState, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  learned: 'Learned',
  'needs-revision': 'Needs revision',
};

/**
 * The status picture alone (decorative). Not-started renders nothing, or a hollow ring with `placeholder`,
 * so lists that lead with the glyph keep their text aligned.
 */
export function StatusGlyph({ state, className = 'size-4', placeholder = false }: { state: TopicState | undefined; className?: string; placeholder?: boolean }) {
  if (state === 'learned')
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={`${className} text-accent-ink`} fill="currentColor">
        <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.7-9.3-4 4a1 1 0 0 1-1.4 0l-2-2a1 1 0 1 1 1.4-1.4L9 10.6l3.3-3.3a1 1 0 0 1 1.4 1.4z" />
      </svg>
    );
  if (state === 'needs-revision')
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={`${className} text-amber-600 dark:text-amber-400`} fill="currentColor">
        <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4a1 1 0 0 1 1 1v3.6l2.2 1.3a1 1 0 1 1-1 1.7l-2.7-1.6A1 1 0 0 1 9 11V7a1 1 0 0 1 1-1z" />
      </svg>
    );
  if (state === 'in-progress')
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={`${className} text-muted`}>
        <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" />
      </svg>
    );
  if (!placeholder) return null;
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={`${className} text-line`}>
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Screen-reader text for a status, e.g. " (Learned)"; nothing for not-started. */
export function StatusLabel({ state }: { state: TopicState | undefined }) {
  if (!state || state === 'not-started') return null;
  // A real space so link names read "Caching (Learned)", not "Caching(Learned)".
  return (
    <>
      {' '}
      <span className="sr-only">({STATE_LABEL[state]})</span>
    </>
  );
}

/** Small status marker; renders nothing for not-started. Includes screen-reader text. */
export function TopicStatusIcon({ state, className = 'size-4' }: { state: TopicState | undefined; className?: string }) {
  if (!state || state === 'not-started') return null;
  return (
    <>
      {' '}
      <span className="inline-flex shrink-0 items-center" title={STATE_LABEL[state]}>
        <span className="sr-only">({STATE_LABEL[state]})</span>
        <StatusGlyph state={state} className={className} />
      </span>
    </>
  );
}
