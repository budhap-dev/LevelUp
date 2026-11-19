import type { Question } from '@/lib/content/schema';
import { LevelBadge } from '@/components/Badge';
import { Prose } from '@/components/Prose';

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg-soft">
        {items.map((html, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: html }} />
        ))}
      </ul>
    </div>
  );
}

/** Questions collapsed by default so you can try answering before reading. */
export function QuestionList({ questions }: { questions: Question[] }) {
  return (
    <ol className="mt-6 space-y-3">
      {questions.map((q, i) => (
        <li key={q.id} id={`q-${q.id}`} className="scroll-mt-32">
          <details className="animated group rounded-xl border border-line bg-surface transition-colors duration-300 open:border-accent">
            <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl p-4 hover:bg-subtle [&::-webkit-details-marker]:hidden">
              <span className="mt-0.5 text-sm text-muted tabular-nums">{i + 1}.</span>
              <span className="flex-1 font-medium text-fg">{q.question}</span>
              <LevelBadge level={q.level} />
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0 text-muted transition-transform duration-300 ease-(--ease-out-expo) group-open:rotate-180">
                <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
              </svg>
            </summary>
            <div className="border-t border-line p-4">
              <h4 className="text-sm font-semibold">Model answer</h4>
              <Prose html={q.modelAnswerHtml} className="mt-2 text-[0.95rem]" />
              <div className="mt-5 rounded-lg bg-accent-soft p-4">
                <h4 className="text-sm font-semibold text-accent-ink">What the interviewer is looking for</h4>
                <Prose html={q.lookingForHtml} className="mt-2 text-sm" />
              </div>
              <Bullets title="Follow-ups" items={q.followUpsHtml} />
              <Bullets title="Red flags" items={q.redFlagsHtml} />
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
