import { useMemo } from 'react';
import { Link } from 'react-router';
import { getTopicMeta, groups, topics, topicsInGroup } from '@/lib/content';
import { SECTIONS } from '@/lib/content/constants';
import { useProgress } from '@/lib/progress/react';

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-1.5 overflow-hidden rounded-full bg-subtle">
      <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-(--ease-out-expo)" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DashboardPage() {
  const progress = useProgress((d) => d.topics);
  const withContent = topics.filter((t) => t.status !== 'stub');
  const learned = withContent.filter((t) => progress[t.id]?.state === 'learned').length;
  const questions = topics.reduce((n, t) => n + t.questionCount, 0);

  /** Most recently read topic that isn't finished. */
  const resume = useMemo(() => {
    const [latest] = Object.entries(progress)
      .filter(([id, p]) => p.lastVisitedAt && p.state !== 'learned' && getTopicMeta(id))
      .sort(([, a], [, b]) => b.lastVisitedAt!.localeCompare(a.lastVisitedAt!));
    if (!latest) return null;
    const [id, p] = latest;
    return { meta: getTopicMeta(id)!, section: SECTIONS.find((s) => s.id === p.lastSectionId), at: p.lastVisitedAt! };
  }, [progress]);

  const revision = useMemo(
    () => topics.filter((t) => progress[t.id]?.state === 'needs-revision').sort((a, b) => progress[a.id]!.updatedAt.localeCompare(progress[b.id]!.updatedAt)),
    [progress],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight text-fg">Dashboard</h1>
      <p className="mt-2 text-muted">
        {topics.length} topics across {groups.length} groups · {withContent.length} with content · {questions} interview questions
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {resume ? (
          <Link
            to={`/topics/${resume.meta.id}${resume.section ? `#${resume.section.id}` : ''}`}
            className="group rounded-xl border border-accent bg-accent-soft p-5 transition duration-300 ease-(--ease-out-expo) hover:-translate-y-0.5 lg:col-span-2"
          >
            <p className="text-xs font-semibold tracking-wide text-accent-ink uppercase">Continue where you left off</p>
            <p className="mt-2 text-xl font-semibold text-fg">{resume.meta.title}</p>
            <p className="mt-1 text-sm text-fg-soft">
              {resume.section ? `${resume.section.heading} · ` : ''}last read {new Date(resume.at).toLocaleDateString()}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent-ink">
              Resume
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 transition-transform duration-300 group-hover:translate-x-1" fill="currentColor">
                <path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L11.6 10 7.3 5.7a1 1 0 0 1 0-1.4z" />
              </svg>
            </span>
          </Link>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Get started</p>
            <p className="mt-2 text-xl font-semibold text-fg">Pick a topic and start reading</p>
            <p className="mt-1 text-sm text-muted">Your place is remembered, so you can always continue from here.</p>
            <Link to="/topics?content=1" className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-opacity hover:opacity-90">
              Browse topics with content
            </Link>
          </div>
        )}

        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Your progress</p>
          <p className="mt-2 text-3xl font-semibold text-fg tabular-nums">
            {learned}
            <span className="text-lg font-normal text-muted"> / {withContent.length} learned</span>
          </p>
          <div className="mt-3">
            <ProgressBar value={learned} max={withContent.length} label="Topics learned" />
          </div>
          {revision.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-fg">Needs revision</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {revision.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/topics/${t.id}`}
                      className="inline-flex rounded-full border border-line px-2.5 py-0.5 text-xs text-fg-soft transition-colors hover:border-accent hover:text-accent-ink"
                    >
                      {t.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-fg">Topic groups</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const inGroup = topicsInGroup(g.id);
          const groupLearned = inGroup.filter((t) => progress[t.id]?.state === 'learned').length;
          const groupWithContent = inGroup.filter((t) => t.status !== 'stub').length;
          return (
            <li key={g.id}>
              <Link
                to={`/topics?group=${g.id}`}
                className="flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition duration-300 ease-(--ease-out-expo) hover:-translate-y-0.5 hover:border-accent"
              >
                <h3 className="font-semibold text-fg">{g.title}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{g.description}</p>
                <div className="mt-4">
                  <ProgressBar value={groupLearned} max={inGroup.length} label={`${g.title}: topics learned`} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {groupLearned}/{inGroup.length} learned · {groupWithContent} with content
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
