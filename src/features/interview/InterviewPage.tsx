import { useEffect, useMemo, useRef, useState } from 'react';
import type { Question } from '@/lib/content/schema';
import { useProgress } from '@/lib/progress/react';
import { buildQueue } from '@/lib/srs/queue';
import { LevelBadge } from '@/components/Badge';
import { AnswerBody } from '@/features/topic/QuestionList';
import { SessionSetup, useLoadedTopics, usePersistedSetup, type SetupState } from '@/features/review/SessionSetup';
import { RatingBar, SessionHeader, SessionSummary } from '@/features/review/SessionChrome';
import { useReviewSession, useSessionKeys, type SessionCard } from '@/features/review/useReviewSession';

interface InterviewCard extends SessionCard {
  question: Question;
  topicTitle: string;
}

/** Elapsed time since the question appeared; stops when the answer is revealed. */
function Timer({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return (
    <span className="font-mono text-sm text-muted tabular-nums" title="Time thinking" aria-label={`Thinking for ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds`} role="timer">
      {mm}:{ss}
    </span>
  );
}

function InterviewSession({ cards, onRestart, onSetup }: { cards: InterviewCard[]; onRestart: () => void; onSetup: () => void }) {
  const s = useReviewSession(cards);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  useSessionKeys({ active: !s.done, revealed: s.revealed, reveal: s.reveal, rate: s.rate });

  // The reveal button disappears when pressed; put focus on the answer instead of losing it.
  useEffect(() => {
    if (s.revealed) answerRef.current?.focus({ preventScroll: true });
  }, [s.revealed]);

  // Move focus to each new question so screen readers announce it.
  useEffect(() => {
    if (s.position > 0) headingRef.current?.focus();
  }, [s.position]);

  if (s.done || !s.current) {
    return <SessionSummary tally={s.tally} cardIds={cards.map((c) => c.cardId)} onRestart={onRestart} onSetup={onSetup} />;
  }
  const { question, topicTitle } = s.current;

  return (
    <div>
      <SessionHeader position={s.position} total={s.total} onEnd={s.finish} />
      <article key={`${s.current.cardId}-${s.position}`} className="mt-6 animate-page-in rounded-2xl border border-line bg-surface p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{topicTitle}</span>
          <LevelBadge level={question.level} />
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="mt-3 text-xl leading-snug font-semibold text-fg focus:outline-none sm:text-2xl">
          {question.question}
        </h2>

        {!s.revealed ? (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-subtle p-4">
            <p className="text-sm text-fg-soft">Answer out loud or jot notes as if you were in the interview, then reveal the model answer.</p>
            <div className="flex items-center gap-4">
              <Timer running={!s.revealed} />
              <button
                type="button"
                onClick={s.reveal}
                aria-keyshortcuts="Space"
                className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
              >
                Reveal answer <kbd className="ml-1 hidden font-sans text-xs opacity-75 sm:inline">Space</kbd>
              </button>
            </div>
          </div>
        ) : (
          <div ref={answerRef} tabIndex={-1} aria-label="Model answer" role="region" className="mt-6 animate-page-in border-t border-line pt-6 focus:outline-none">
            <AnswerBody q={question} />
          </div>
        )}
      </article>
      {s.revealed && <RatingBar card={s.current} onRate={s.rate} />}
    </div>
  );
}

export function InterviewPage() {
  const [setup, setSetup] = usePersistedSetup('interview');
  const { loaded, ready } = useLoadedTopics(setup.topicIds);
  const reviews = useProgress((d) => d.reviews);
  const [session, setSession] = useState<{ cards: InterviewCard[]; key: number } | null>(null);

  const candidates = useMemo(
    () =>
      setup.topicIds.flatMap((id) => {
        const topic = loaded.get(id);
        if (!topic) return [];
        return topic.questions
          .filter((q) => setup.levels.includes(q.level))
          .map((q): InterviewCard => ({ cardId: `${id}#q-${q.id}`, kind: 'question', question: q, topicTitle: topic.meta.title }));
      }),
    [setup.topicIds, setup.levels, loaded],
  );

  const counts = useMemo(
    () => (ready ? buildQueue(candidates, reviews, new Date(), { limit: Infinity, includeNotDue: false }).counts : null),
    [ready, candidates, reviews],
  );

  const start = (s: SetupState = setup) => {
    const { queue } = buildQueue(candidates, reviews, new Date(), { limit: s.size, includeNotDue: s.ahead });
    setSession({ cards: queue, key: Date.now() });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-fg">Interview mode</h1>
      {!session && (
        <p className="mt-2 mb-6 text-muted">
          Questions you rate are scheduled with spaced repetition: hard ones come back sooner, easy ones later. Due questions come first, then new ones at random.
        </p>
      )}
      <div className={session ? 'mt-6' : ''}>
        {session ? (
          <InterviewSession key={session.key} cards={session.cards} onRestart={() => start()} onSetup={() => setSession(null)} />
        ) : (
          <SessionSetup state={setup} onChange={setSetup} showLevels counts={counts} unit="questions" onStart={() => start()} />
        )}
      </div>
    </div>
  );
}
