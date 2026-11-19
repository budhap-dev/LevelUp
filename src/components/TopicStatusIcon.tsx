import type { TopicState } from '@/lib/progress/types';

export const STATE_LABEL: Record<TopicState, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  learned: 'Learned',
  'needs-revision': 'Needs revision',
};

/** Small status marker; renders nothing for not-started. Includes screen-reader text. */
export function TopicStatusIcon({ state, className = 'size-4' }: { state: TopicState | undefined; className?: string }) {
  if (!state || state === 'not-started') return null;
  return (
    <>
      {/* A real space so link names read "Caching (Learned)", not "Caching(Learned)". */}{' '}
    <span className="inline-flex shrink-0 items-center" title={STATE_LABEL[state]}>
      <span className="sr-only">({STATE_LABEL[state]})</span>
      {state === 'learned' && (
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`${className} text-accent-ink`} fill="currentColor">
          <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.7-9.3-4 4a1 1 0 0 1-1.4 0l-2-2a1 1 0 1 1 1.4-1.4L9 10.6l3.3-3.3a1 1 0 0 1 1.4 1.4z" />
        </svg>
      )}
      {state === 'needs-revision' && (
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`${className} text-amber-600 dark:text-amber-400`} fill="currentColor">
          <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4a1 1 0 0 1 1 1v3.6l2.2 1.3a1 1 0 1 1-1 1.7l-2.7-1.6A1 1 0 0 1 9 11V7a1 1 0 0 1 1-1z" />
        </svg>
      )}
      {state === 'in-progress' && (
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`${className} text-muted`}>
          <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" />
        </svg>
      )}
    </span>
    </>
  );
}
