import { useMemo } from 'react';
import { useProgress } from '@/lib/progress/react';

/** Number of reviewed cards that are due now, by kind (new, never-reviewed cards aren't counted). */
export function useDueCounts(): { questions: number; flashcards: number } {
  const reviews = useProgress((d) => d.reviews);
  return useMemo(() => {
    const now = Date.now();
    let questions = 0;
    let flashcards = 0;
    for (const card of Object.values(reviews)) {
      if (Date.parse(card.dueAt) > now) continue;
      if (card.kind === 'question') questions += 1;
      else flashcards += 1;
    }
    return { questions, flashcards };
  }, [reviews]);
}
