import type { Question } from '@/lib/content/schema';
import { LevelBadge } from '@/components/Badge';
import { Prose } from '@/components/Prose';

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
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
        <li key={q.id} id={`q-${q.id}`} className="scroll-mt-20">
          <details className="group rounded-xl border border-slate-200 dark:border-slate-800">
            <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl p-4 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:bg-slate-900 [&::-webkit-details-marker]:hidden">
              <span className="mt-0.5 text-sm text-slate-400 tabular-nums">{i + 1}.</span>
              <span className="flex-1 font-medium">{q.question}</span>
              <LevelBadge level={q.level} />
            </summary>
            <div className="border-t border-slate-200 p-4 dark:border-slate-800">
              <h4 className="text-sm font-semibold">Model answer</h4>
              <Prose html={q.modelAnswerHtml} className="mt-2 text-[0.95rem]" />
              <div className="mt-5 rounded-lg bg-indigo-50 p-4 dark:bg-indigo-950/50">
                <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">What the interviewer is looking for</h4>
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
