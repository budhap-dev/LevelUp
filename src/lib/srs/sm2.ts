/**
 * Spaced repetition: SM-2 (SuperMemo 2) with two small, common adjustments.
 *
 * Ratings map to SM-2 quality: Again 1 · Hard 3 · Good 4 · Easy 5.
 * - Easiness (EF) starts at 2.5 and changes by SM-2's formula after every review, never below 1.3.
 * - Pass (Hard/Good/Easy): repetition 1 → 1 day, repetition 2 → 6 days, then previous interval × EF.
 * - Fail (Again): repetitions reset; the card is due again in 10 minutes (and re-shown in the session).
 * Adjustments (as in Anki): Hard grows the interval by only ×1.2; Easy gets a ×1.3 bonus
 * (so even a brand-new card answered "Easy" waits 4 days rather than 1).
 */
import type { Rating, ReviewCard } from '@/lib/progress/types';

export const RATINGS: readonly Rating[] = ['again', 'hard', 'good', 'easy'];
const QUALITY: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export const INITIAL_EASINESS = 2.5;
export const MIN_EASINESS = 1.3;
const RELEARN_MINUTES = 10;
const HARD_FACTOR = 1.2;
const EASY_BONUS = 1.3;
const DAY_MS = 86_400_000;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function nextEasiness(easiness: number, rating: Rating): number {
  const q = QUALITY[rating];
  return Math.max(MIN_EASINESS, round2(easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));
}

/** Schedule a card after a review. `card` is undefined for a card never reviewed before. */
export function review(card: ReviewCard | undefined, cardId: string, kind: ReviewCard['kind'], rating: Rating, now: Date): ReviewCard {
  const prev = card ?? { cardId, kind, easiness: INITIAL_EASINESS, intervalDays: 0, repetitions: 0, lapses: 0, dueAt: now.toISOString() };
  const easiness = nextEasiness(prev.easiness, rating);

  if (rating === 'again') {
    return {
      ...prev,
      cardId,
      kind,
      easiness,
      repetitions: 0,
      intervalDays: 0,
      lapses: prev.lapses + (prev.repetitions > 0 ? 1 : 0),
      dueAt: new Date(now.getTime() + RELEARN_MINUTES * 60_000).toISOString(),
      lastReviewedAt: now.toISOString(),
    };
  }

  const repetitions = prev.repetitions + 1;
  let interval: number;
  if (repetitions === 1) {
    interval = rating === 'easy' ? 4 : 1;
  } else if (repetitions === 2) {
    interval = rating === 'hard' ? prev.intervalDays * HARD_FACTOR : 6;
  } else {
    interval = prev.intervalDays * (rating === 'hard' ? HARD_FACTOR : prev.easiness);
  }
  if (rating === 'easy' && repetitions > 1) interval *= EASY_BONUS;
  // A pass never shortens the interval, and is at least a day.
  const intervalDays = Math.max(1, prev.intervalDays, Math.round(interval));

  return {
    cardId,
    kind,
    easiness,
    repetitions,
    lapses: prev.lapses,
    intervalDays,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
    lastReviewedAt: now.toISOString(),
  };
}

export const isDue = (card: ReviewCard | undefined, now: Date) => !!card && Date.parse(card.dueAt) <= now.getTime();

/** Short human label for when a card would next be due, e.g. "10m", "1d", "6d", "3w", "2mo". */
export function formatInterval(card: ReviewCard, now: Date): string {
  const ms = Date.parse(card.dueAt) - now.getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const days = Math.round(ms / DAY_MS);
  if (days < 1) return `${Math.round(minutes / 60)}h`;
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round((days / 365) * 10) / 10}y`;
}
