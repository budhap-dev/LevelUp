import { useEffect, useMemo } from 'react';
import { Link, useLoaderData, useLocation, type LoaderFunctionArgs } from 'react-router';
import { getGroup, getTopicMeta, loadTopic } from '@/lib/content';
import type { Topic } from '@/lib/content/schema';
import { Badge, LevelBadge, StatusBadge } from '@/components/Badge';
import { Prose } from '@/components/Prose';
import { QuestionList } from './QuestionList';
import { SectionHeading, TocChips, TocSidebar, type TocItem } from './TopicToc';
import { useActiveSection } from './useActiveSection';
import { TopicToolbar } from './TopicToolbar';
import { NotesPanel } from './NotesPanel';
import { useProgressController } from '@/lib/progress/react';

export async function topicLoader({ params }: LoaderFunctionArgs): Promise<Topic> {
  const topic = params.topicId ? await loadTopic(params.topicId) : undefined;
  if (!topic) throw new Response('Topic not found', { status: 404, statusText: 'Topic not found' });
  return topic;
}

/**
 * When arriving at #anchor (search results, shared links): open the question if it is one,
 * and briefly ring the target. React Router's ScrollRestoration does the scrolling.
 */
function useHashTarget(hash: string, navKey: string) {
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    const details = el.querySelector('details');
    if (details) details.open = true;
    const target = details ?? (el.tagName === 'SECTION' ? el.querySelector('h2') : el) ?? el;
    target.classList.remove('flash-target');
    void target.getBoundingClientRect(); // restart the animation
    target.classList.add('flash-target');
    const clear = () => target.classList.remove('flash-target');
    target.addEventListener('animationend', clear, { once: true });
    return () => target.removeEventListener('animationend', clear);
  }, [hash, navKey]);
}

export function TopicPage() {
  const topic = useLoaderData() as Topic;
  const { meta } = topic;
  const group = getGroup(meta.group);
  const location = useLocation();
  useHashTarget(location.hash, location.key);

  const toc: TocItem[] = useMemo(
    () =>
      [
        ...topic.sections.map((s) => ({
          id: s.id,
          title: s.title,
          count: s.id === 'interview-questions' ? topic.questions.length : undefined,
        })),
        ...(topic.sections.length ? [{ id: 'notes', title: 'Your notes' }] : []),
      ],
    [topic],
  );
  const active = useActiveSection(useMemo(() => toc.map((t) => t.id), [toc]));

  // Remember what's being read, for "continue where you left off". Stubs don't count as learning.
  const progress = useProgressController();
  useEffect(() => {
    if (meta.status !== 'stub') progress.recordVisit(meta.id, active);
  }, [progress, meta.id, meta.status, active]);

  return (
    <div className="mx-auto max-w-6xl xl:grid xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-12">
      <article className="max-w-4xl min-w-0">
        <header className="mb-6">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link to={`/topics?group=${meta.group}`} className="hover:text-accent-ink hover:underline">
              {group?.title}
            </Link>
          </nav>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{meta.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <LevelBadge level={meta.level} />
            <StatusBadge status={meta.status} />
            {meta.verifyCount > 0 && (
              <Badge tone="warning" title="Claims marked VERIFY: in the source still need checking">
                {meta.verifyCount} unverified claim{meta.verifyCount === 1 ? '' : 's'}
              </Badge>
            )}
            <span className="text-muted">
              {meta.estimatedMinutes} min · reviewed {meta.lastReviewed}
            </span>
          </div>
          {meta.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
              {meta.tags.map((t) => (
                <li key={t}>
                  <Link
                    to={`/topics?tag=${encodeURIComponent(t)}`}
                    className="inline-flex rounded-full border border-line bg-subtle px-2 py-0.5 text-xs font-medium text-fg-soft transition-colors hover:border-accent hover:text-accent-ink"
                  >
                    #{t}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <TopicToolbar meta={meta} />
        </header>

        {meta.status === 'stub' ? (
          <div className="mt-10 rounded-xl border border-dashed border-line p-8 text-center">
            <h2 className="text-lg font-semibold text-fg">No content yet</h2>
            <p className="mt-2 text-muted">
              Generate it with <code className="text-sm">docs/prompts/generate-topic.md</code>, then save it to{' '}
              <code className="text-sm">
                content/{meta.group}/{meta.id}.md
              </code>
              .
            </p>
          </div>
        ) : (
          <>
            <TocChips items={toc} active={active} />
            {topic.sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-10 scroll-mt-32 first-of-type:mt-6">
                <SectionHeading id={s.id} title={s.title} />
                {s.id === 'interview-questions' ? <QuestionList questions={topic.questions} /> : <Prose html={s.html} className="mt-6" />}
              </section>
            ))}
          </>
        )}

        <NotesPanel topicId={meta.id} />

        {meta.related.length > 0 && (
          <aside className="mt-16 border-t border-line pt-6" aria-labelledby="related-h">
            <h2 id="related-h" className="text-sm font-semibold tracking-wide text-muted uppercase">
              Related topics
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {meta.related.map((id) => (
                <li key={id}>
                  <Link
                    to={`/topics/${id}`}
                    className="inline-block rounded-lg border border-line bg-surface px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent-ink"
                  >
                    {getTopicMeta(id)?.title ?? id}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </article>

      {meta.status !== 'stub' && (
        <aside className="hidden xl:block">
          <TocSidebar items={toc} active={active} />
        </aside>
      )}
    </div>
  );
}
