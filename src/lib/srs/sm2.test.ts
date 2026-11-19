import type { Rating, ReviewCard } from '@/lib/progress/types';
import { buildQueue, shuffle } from './queue';
import { MIN_EASINESS, formatInterval, isDue, nextEasiness, review } from './sm2';

const NOW = new Date('2026-11-19T09:00:00.000Z');
const DAY = 86_400_000;

/** Review a new card with a sequence of ratings, each on the day it falls due. */
function run(ratings: Rating[]): ReviewCard[] {
  const history: ReviewCard[] = [];
  let card: ReviewCard | undefined;
  let now = NOW;
  for (const r of ratings) {
    card = review(card, 'c', 'question', r, now);
    history.push(card);
    now = new Date(card.dueAt);
  }
  return history;
}

describe('SM-2 scheduling', () => {
  it('follows 1 day → 6 days → interval × easiness for Good', () => {
    expect(run(['good', 'good', 'good', 'good']).map((c) => c.intervalDays)).toEqual([1, 6, 15, 38]);
  });

  it('keeps easiness at 2.5 for Good, raises it for Easy and lowers it for Hard/Again', () => {
    expect(nextEasiness(2.5, 'good')).toBe(2.5);
    expect(nextEasiness(2.5, 'easy')).toBe(2.6);
    expect(nextEasiness(2.5, 'hard')).toBe(2.36);
    expect(nextEasiness(2.5, 'again')).toBe(1.96);
  });

  it('never lets easiness fall below 1.3', () => {
    const cards = run(['again', 'again', 'again', 'again', 'again']);
    expect(cards.at(-1)!.easiness).toBe(MIN_EASINESS);
  });

  it('Again resets repetitions, schedules 10 minutes later and counts a lapse only for learned cards', () => {
    const [newFail] = run(['again']);
    expect(newFail).toMatchObject({ repetitions: 0, intervalDays: 0, lapses: 0 });
    expect(Date.parse(newFail!.dueAt) - NOW.getTime()).toBe(10 * 60_000);

    const lapsed = run(['good', 'good', 'again']).at(-1)!;
    expect(lapsed).toMatchObject({ repetitions: 0, intervalDays: 0, lapses: 1 });
    // Relearning starts again at 1 day.
    expect(review(lapsed, 'c', 'question', 'good', new Date(lapsed.dueAt)).intervalDays).toBe(1);
  });

  it('Easy gives a bonus and Hard grows slowly', () => {
    expect(run(['easy']).map((c) => c.intervalDays)).toEqual([4]);
    expect(run(['good', 'easy']).map((c) => c.intervalDays)).toEqual([1, 8]);
    expect(run(['good', 'good', 'hard']).map((c) => c.intervalDays)).toEqual([1, 6, 7]);
    // Hard never shortens an interval.
    expect(run(['good', 'hard']).map((c) => c.intervalDays)).toEqual([1, 1]);
  });

  it('records timestamps and due dates', () => {
    const [card] = run(['good']);
    expect(card!.lastReviewedAt).toBe(NOW.toISOString());
    expect(card!.dueAt).toBe(new Date(NOW.getTime() + DAY).toISOString());
    expect(isDue(card, NOW)).toBe(false);
    expect(isDue(card, new Date(NOW.getTime() + DAY))).toBe(true);
    expect(isDue(undefined, NOW)).toBe(false);
  });

  it('formats intervals compactly', () => {
    const at = (ms: number) => ({ dueAt: new Date(NOW.getTime() + ms).toISOString() }) as ReviewCard;
    expect(formatInterval(at(10 * 60_000), NOW)).toBe('10m');
    expect(formatInterval(at(DAY), NOW)).toBe('1d');
    expect(formatInterval(at(6 * DAY), NOW)).toBe('6d');
    expect(formatInterval(at(21 * DAY), NOW)).toBe('3w');
    expect(formatInterval(at(90 * DAY), NOW)).toBe('3mo');
  });
});

describe('buildQueue', () => {
  const card = (id: string, dueInDays: number): ReviewCard => ({
    cardId: id, kind: 'question', easiness: 2.5, intervalDays: 1, repetitions: 1, lapses: 0, dueAt: new Date(NOW.getTime() + dueInDays * DAY).toISOString(),
  });
  const items = ['a', 'b', 'c', 'd', 'e'].map((cardId) => ({ cardId }));
  const reviews = { a: card('a', -1), b: card('b', -3), c: card('c', 2) }; // d, e are new

  it('puts due cards first (most overdue first), then new cards, and skips cards not yet due', () => {
    const { queue, counts } = buildQueue(items, reviews, NOW, { limit: 10, includeNotDue: false, random: () => 0 });
    expect(queue.map((i) => i.cardId).slice(0, 2)).toEqual(['b', 'a']);
    expect(queue.map((i) => i.cardId).slice(2).sort()).toEqual(['d', 'e']);
    expect(counts).toEqual({ due: 2, fresh: 2, later: 1 });
  });

  it('can practise ahead and respects the limit', () => {
    expect(buildQueue(items, reviews, NOW, { limit: 10, includeNotDue: true }).queue.at(-1)?.cardId).toBe('c');
    expect(buildQueue(items, reviews, NOW, { limit: 3, includeNotDue: true }).queue).toHaveLength(3);
  });

  it('shuffles deterministically with an injected random source', () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(shuffle([1, 2, 3, 4], () => 0.999)).toEqual([1, 2, 3, 4]);
  });
});
