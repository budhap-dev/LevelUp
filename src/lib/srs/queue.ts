import type { ReviewCard } from '@/lib/progress/types';

export interface QueueOptions {
  /** Maximum cards in the session. */
  limit: number;
  /** Also include cards that are scheduled but not yet due (practice ahead). */
  includeNotDue: boolean;
  /** Random source, injectable for tests. */
  random?: () => number;
}

export interface QueueResult<T> {
  queue: T[];
  /** How many candidates were in each bucket (before the limit). */
  counts: { due: number; fresh: number; later: number };
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Order a session: due cards first (most overdue first), then new cards in random order,
 * then — only when practising ahead — scheduled cards soonest first.
 */
export function buildQueue<T extends { cardId: string }>(
  items: T[],
  reviews: Record<string, ReviewCard>,
  now: Date,
  { limit, includeNotDue, random = Math.random }: QueueOptions,
): QueueResult<T> {
  const due: T[] = [];
  const fresh: T[] = [];
  const later: T[] = [];
  for (const item of items) {
    const card = reviews[item.cardId];
    if (!card) fresh.push(item);
    else if (Date.parse(card.dueAt) <= now.getTime()) due.push(item);
    else later.push(item);
  }
  const byDue = (a: T, b: T) => Date.parse(reviews[a.cardId]!.dueAt) - Date.parse(reviews[b.cardId]!.dueAt);
  const ordered = [...due.sort(byDue), ...shuffle(fresh, random), ...(includeNotDue ? later.sort(byDue) : [])];
  return { queue: ordered.slice(0, limit), counts: { due: due.length, fresh: fresh.length, later: later.length } };
}
