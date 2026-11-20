import { Link, useParams } from 'react-router';
import { paths } from '@/lib/content';
import { pathProgress } from '@/lib/paths';
import { useProgress } from '@/lib/progress/react';
import { ProgressBar } from '@/components/ProgressBar';
import { LevelBadge, StatusBadge } from '@/components/Badge';
import { TopicStatusIcon } from '@/components/TopicStatusIcon';
import { NotFound } from '@/app/NotFound';

export function PathPage() {
  const { pathId } = useParams();
  const progress = useProgress((d) => d.topics);
  const path = paths.find((p) => p.id === pathId);
  if (!path) return <NotFound />;
  const pp = pathProgress(path, progress);

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/paths" className="text-sm text-muted transition-colors hover:text-accent-ink">
        ← All learning paths
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">{path.title}</h1>
      <p className="mt-2 text-fg-soft">{path.description}</p>
      <div className="mt-6">
        <ProgressBar value={pp.learned} max={pp.required} label="Path steps learned" />
        <p className="mt-2 text-sm text-muted">
          {pp.learned} of {pp.required} steps learned{pp.steps.length > pp.required ? ` · ${pp.steps.length - pp.required} optional` : ''}
        </p>
      </div>
      {pp.next && (
        <Link
          to={`/topics/${pp.next.meta.id}`}
          className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          {pp.learned === 0 ? 'Start' : 'Continue'} with {pp.next.meta.title}
        </Link>
      )}

      <ol aria-label="Steps" className="mt-8 space-y-3">
        {pp.steps.map((s, i) => {
          const isNext = s === pp.next;
          return (
            <li key={s.meta.id}>
              <Link
                to={`/topics/${s.meta.id}`}
                aria-current={isNext ? 'step' : undefined}
                className={`flex gap-4 rounded-xl border p-4 transition-colors hover:border-accent ${isNext ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${s.learned ? 'bg-accent text-on-accent' : 'bg-subtle text-fg-soft'}`}
                >
                  {s.learned ? '✓' : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium text-fg">
                    {s.meta.title}
                    <TopicStatusIcon state={progress[s.meta.id]?.state} />
                    {s.optional && <span className="text-xs font-normal text-muted">Optional</span>}
                  </span>
                  {s.note && <span className="mt-1 block text-sm text-fg-soft">{s.note}</span>}
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <LevelBadge level={s.meta.level} />
                    <StatusBadge status={s.meta.status} />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
