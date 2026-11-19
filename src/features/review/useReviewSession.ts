import { useCallback, useEffect, useState } from 'react';
import { useProgressController } from '@/lib/progress/react';
import type { Rating, ReviewCard } from '@/lib/progress/types';

export interface SessionCard {
  cardId: string;
  kind: ReviewCard['kind'];
}

/** How many cards later a card rated "Again" comes back in the same session. */
const AGAIN_GAP = 3;

export type Tally = Record<Rating, number>;

/**
 * Drives one review session over a fixed queue: reveal → rate → next.
 * Ratings are recorded (SM-2) immediately; "Again" re-queues the card a few cards later.
 */
export function useReviewSession<T extends SessionCard>(cards: T[]) {
  const progress = useProgressController();
  const [queue, setQueue] = useState(cards);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState<Tally>({ again: 0, hard: 0, good: 0, easy: 0 });
  const current = queue[position];

  const reveal = useCallback(() => setRevealed(true), []);

  const rate = useCallback(
    (rating: Rating) => {
      if (!current || !revealed) return;
      progress.recordReview(current.cardId, current.kind, rating);
      setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
      if (rating === 'again') {
        setQueue((q) => {
          const next = [...q];
          next.splice(Math.min(position + 1 + AGAIN_GAP, q.length), 0, current);
          return next;
        });
      }
      setPosition((p) => p + 1);
      setRevealed(false);
    },
    [current, revealed, position, progress],
  );

  const finish = useCallback(() => setPosition(queue.length), [queue.length]);

  return {
    current,
    position,
    total: queue.length,
    uniqueCards: cards.length,
    revealed,
    reveal,
    rate,
    finish,
    done: position >= queue.length,
    reviewed: Object.values(tally).reduce((a, b) => a + b, 0),
    tally,
  };
}

const KEY_TO_RATING: Record<string, Rating> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };

/** Space/Enter reveals; 1–4 rate. Ignored while typing or when a button already handles the key. */
export function useSessionKeys({ active, revealed, reveal, rate }: { active: boolean; revealed: boolean; reveal: () => void; rate: (r: Rating) => void }) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest('dialog[open]')) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        if (/^(BUTTON|A|SUMMARY)$/.test(t.tagName)) return; // native activation handles it
        e.preventDefault();
        reveal();
      } else if (revealed && KEY_TO_RATING[e.key]) {
        e.preventDefault();
        rate(KEY_TO_RATING[e.key]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, revealed, reveal, rate]);
}
