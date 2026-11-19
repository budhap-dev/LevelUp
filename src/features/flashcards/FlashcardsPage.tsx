import { useEffect, useMemo, useRef, useState } from 'react';
import type { Flashcard } from '@/lib/content/schema';
import { useProgress } from '@/lib/progress/react';
import { buildQueue } from '@/lib/srs/queue';
import { Prose } from '@/components/Prose';
import { SessionSetup, useLoadedTopics, usePersistedSetup } from '@/features/review/SessionSetup';
import { RatingBar, SessionHeader, SessionSummary } from '@/features/review/SessionChrome';
import { useReviewSession, useSessionKeys, type SessionCard } from '@/features/review/useReviewSession';

interface FlashcardItem extends SessionCard {
  card: Flashcard;
  topicTitle: string;
}

/** A card that flips in 3D to reveal its back. Hidden faces are inert, so only the visible side is reachable. */
function FlipCard({ item, flipped, onFlip }: { item: FlashcardItem; flipped: boolean; onFlip: () => void }) {
  const backRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (flipped) backRef.current?.focus({ preventScroll: true });
  }, [flipped]);

  const face = 'flip-face flex min-h-64 flex-col rounded-2xl border bg-surface p-6 sm:min-h-72 sm:p-8';
  return (
    <div className="flip mt-6">
      <div className="flip-inner" data-flipped={flipped}>
        <div className={`${face} border-line`} inert={flipped} aria-hidden={flipped}>
          <p className="text-sm text-muted">{item.topicTitle}</p>
          <p className="flex flex-1 items-center justify-center py-8 text-center text-2xl font-semibold text-fg sm:text-3xl">{item.card.front}</p>
          <button
            type="button"
            onClick={onFlip}
            aria-keyshortcuts="Space"
            className="mx-auto h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
          >
            Show answer <kbd className="ml-1 hidden font-sans text-xs opacity-75 sm:inline">Space</kbd>
          </button>
        </div>
        <div
          ref={backRef}
          tabIndex={-1}
          role="region"
          aria-label={`Answer: ${item.card.front}`}
          className={`${face} flip-back border-accent focus:outline-none`}
          inert={!flipped}
          aria-hidden={!flipped}
        >
          <p className="text-sm text-muted">
            {item.topicTitle} · <span className="font-medium text-fg">{item.card.front}</span>
          </p>
          <div className="flex flex-1 items-center justify-center py-6">
            <Prose html={item.card.backHtml} className="text-center text-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FlashcardSession({ cards, onRestart, onSetup }: { cards: FlashcardItem[]; onRestart: () => void; onSetup: () => void }) {
  const s = useReviewSession(cards);
  useSessionKeys({ active: !s.done, revealed: s.revealed, reveal: s.reveal, rate: s.rate });

  if (s.done || !s.current) {
    return <SessionSummary tally={s.tally} cardIds={cards.map((c) => c.cardId)} onRestart={onRestart} onSetup={onSetup} />;
  }
  return (
    <div>
      <SessionHeader position={s.position} total={s.total} onEnd={s.finish} />
      <div key={`${s.current.cardId}-${s.position}`} className="animate-page-in">
        <FlipCard item={s.current} flipped={s.revealed} onFlip={s.reveal} />
      </div>
      {s.revealed && <RatingBar card={s.current} onRate={s.rate} />}
    </div>
  );
}

export function FlashcardsPage() {
  const [setup, setSetup] = usePersistedSetup('flashcards');
  const { loaded, ready } = useLoadedTopics(setup.topicIds);
  const reviews = useProgress((d) => d.reviews);
  const [session, setSession] = useState<{ cards: FlashcardItem[]; key: number } | null>(null);

  const candidates = useMemo(
    () =>
      setup.topicIds.flatMap((id) => {
        const topic = loaded.get(id);
        if (!topic) return [];
        return topic.flashcards.map((card): FlashcardItem => ({ cardId: `${id}#${card.id}`, kind: 'flashcard', card, topicTitle: topic.meta.title }));
      }),
    [setup.topicIds, loaded],
  );

  const counts = useMemo(
    () => (ready ? buildQueue(candidates, reviews, new Date(), { limit: Infinity, includeNotDue: false }).counts : null),
    [ready, candidates, reviews],
  );

  const start = () => {
    const { queue } = buildQueue(candidates, reviews, new Date(), { limit: setup.size, includeNotDue: setup.ahead });
    setSession({ cards: queue, key: Date.now() });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight text-fg">Flashcards</h1>
      {!session && <p className="mt-2 mb-6 text-muted">Cards come from each topic's cheat sheet and share the same spaced-repetition schedule as Interview mode.</p>}
      <div className={session ? 'mt-6' : ''}>
        {session ? (
          <FlashcardSession key={session.key} cards={session.cards} onRestart={start} onSetup={() => setSession(null)} />
        ) : (
          <SessionSetup state={setup} onChange={setSetup} showLevels={false} counts={counts} unit="cards" onStart={start} />
        )}
      </div>
    </div>
  );
}
