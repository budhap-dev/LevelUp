import { useEffect, useMemo, useRef } from 'react';
import { useProgress } from '@/lib/progress/react';
import type { Rating } from '@/lib/progress/types';
import { RATINGS, formatInterval, review } from '@/lib/srs/sm2';
import type { SessionCard, Tally } from './useReviewSession';

const RATING_STYLE: Record<Rating, { label: string; help: string; className: string }> = {
  again: { label: 'Again', help: "Didn't know it", className: 'border-red-300 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950' },
  hard: { label: 'Hard', help: 'Got there, with effort', className: 'border-amber-300 hover:bg-amber-50 dark:border-amber-900 dark:hover:bg-amber-950' },
  good: { label: 'Good', help: 'Knew it', className: 'border-accent bg-accent-soft hover:bg-accent hover:text-on-accent' },
  easy: { label: 'Easy', help: 'Instant and complete', className: 'border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950' },
};

/** Again / Hard / Good / Easy, each showing when the card would come back. Keys 1–4. */
export function RatingBar({ card, onRate }: { card: SessionCard; onRate: (r: Rating) => void }) {
  const existing = useProgress((d) => d.reviews[card.cardId]);
  const intervals = useMemo(() => {
    const now = new Date();
    return Object.fromEntries(RATINGS.map((r) => [r, formatInterval(review(existing, card.cardId, card.kind, r, now), now)])) as Record<Rating, string>;
  }, [existing, card.cardId, card.kind]);

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 animate-page-in border-t border-line bg-canvas px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mx-0 sm:px-0">
      <p id="rate-help" className="mb-2 text-center text-sm text-muted">
        How well did you know it?
      </p>
      <div role="group" aria-describedby="rate-help" className="grid grid-cols-4 gap-2">
        {RATINGS.map((r, i) => (
          <button
            key={r}
            type="button"
            onClick={() => onRate(r)}
            aria-keyshortcuts={String(i + 1)}
            title={`${RATING_STYLE[r].help} (key ${i + 1})`}
            className={`flex flex-col items-center rounded-xl border bg-surface px-2 py-2.5 text-fg transition-colors duration-150 ${RATING_STYLE[r].className}`}
          >
            <span className="text-sm font-semibold">{RATING_STYLE[r].label}</span>
            <span className="mt-0.5 text-xs opacity-80">
              <span className="sr-only">next review in </span>
              {intervals[r]}
            </span>
            <kbd className="mt-1 hidden text-[10px] opacity-60 sm:block">{i + 1}</kbd>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SessionHeader({ position, total, onEnd }: { position: number; total: number; onEnd: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="flex justify-between text-xs text-muted">
          <span aria-live="polite">
            Card {Math.min(position + 1, total)} of {total}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-(--ease-out-expo)" style={{ width: `${(position / Math.max(total, 1)) * 100}%` }} />
        </div>
      </div>
      <button type="button" onClick={onEnd} className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-subtle hover:text-fg">
        End session
      </button>
    </div>
  );
}

export function SessionSummary({
  tally,
  cardIds,
  onRestart,
  onSetup,
}: {
  tally: Tally;
  cardIds: string[];
  onRestart: () => void;
  onSetup: () => void;
}) {
  const reviews = useProgress((d) => d.reviews);
  const reviewed = Object.values(tally).reduce((a, b) => a + b, 0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []); // announce the result once
  const nextDue = useMemo(() => {
    const dates = cardIds.map((id) => reviews[id]?.dueAt).filter((d): d is string => !!d).sort();
    return dates[0];
  }, [cardIds, reviews]);

  return (
    <div className="animate-page-in rounded-2xl border border-line bg-surface p-6 text-center sm:p-10">
      <div className="mx-auto flex size-14 animate-pop-in items-center justify-center rounded-full bg-accent text-on-accent">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-7" fill="currentColor">
          <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
        </svg>
      </div>
      <h2 className="mt-4 text-2xl font-semibold text-fg focus:outline-none" tabIndex={-1} ref={headingRef}>
        {reviewed ? 'Session complete' : 'Session ended'}
      </h2>
      <p className="mt-1 text-muted">
        {reviewed} review{reviewed === 1 ? '' : 's'}
        {nextDue && ` · next due ${new Date(nextDue).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
      </p>
      <dl className="mx-auto mt-6 grid max-w-md grid-cols-4 gap-2">
        {RATINGS.map((r) => (
          <div key={r} className="rounded-lg bg-subtle p-3">
            <dt className="text-xs text-muted">{RATING_STYLE[r].label}</dt>
            <dd className="mt-1 text-xl font-semibold text-fg tabular-nums">{tally[r]}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onRestart} className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition-opacity hover:opacity-90">
          Start another session
        </button>
        <button type="button" onClick={onSetup} className="h-10 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg transition-colors hover:border-accent">
          Change topics
        </button>
      </div>
    </div>
  );
}
