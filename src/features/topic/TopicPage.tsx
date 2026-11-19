import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { getGroup, getTopicMeta, loadTopic } from '@/lib/content';
import type { Topic } from '@/lib/content/schema';
import { Badge, LevelBadge, StatusBadge } from '@/components/Badge';
import { Prose } from '@/components/Prose';
import { QuestionList } from './QuestionList';

export async function topicLoader({ params }: LoaderFunctionArgs): Promise<Topic> {
  const topic = params.topicId ? await loadTopic(params.topicId) : undefined;
  if (!topic) throw new Response('Topic not found', { status: 404, statusText: 'Topic not found' });
  return topic;
}

/** Phase 1: sections stacked in order. Tabs/anchors, Mermaid rendering and the toolbar arrive in phase 2–3. */
export function TopicPage() {
  const topic = useLoaderData() as Topic;
  const { meta } = topic;
  const group = getGroup(meta.group);

  return (
    <article className="mx-auto max-w-4xl">
      <header>
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500 dark:text-slate-400">
          <Link to={`/topics?group=${meta.group}`} className="hover:underline">
            {group?.title}
          </Link>
        </nav>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{meta.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <LevelBadge level={meta.level} />
          <StatusBadge status={meta.status} />
          {meta.verifyCount > 0 && (
            <Badge tone="amber" title="Claims marked VERIFY: in the source still need checking">
              {meta.verifyCount} unverified claim{meta.verifyCount === 1 ? '' : 's'}
            </Badge>
          )}
          <span className="text-slate-500 dark:text-slate-400">
            {meta.estimatedMinutes} min · reviewed {meta.lastReviewed}
          </span>
        </div>
        {meta.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
            {meta.tags.map((t) => (
              <li key={t}>
                <Badge>#{t}</Badge>
              </li>
            ))}
          </ul>
        )}
      </header>

      {meta.status === 'stub' ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <h2 className="text-lg font-semibold">No content yet</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Generate it with Prompt 2 using <code className="text-sm">content/_template.md</code>, then save it to{' '}
            <code className="text-sm">
              content/{meta.group}/{meta.id}.md
            </code>
            .
          </p>
        </div>
      ) : (
        topic.sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-12 scroll-mt-20">
            <h2 id={`${s.id}-h`} className="border-b border-slate-200 pb-2 text-2xl font-semibold tracking-tight dark:border-slate-800">
              {s.title}
            </h2>
            {s.id === 'interview-questions' ? <QuestionList questions={topic.questions} /> : <Prose html={s.html} className="mt-6" />}
          </section>
        ))
      )}

      {meta.related.length > 0 && (
        <aside className="mt-16 border-t border-slate-200 pt-6 dark:border-slate-800" aria-labelledby="related-h">
          <h2 id="related-h" className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Related topics
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {meta.related.map((id) => (
              <li key={id}>
                <Link
                  to={`/topics/${id}`}
                  className="inline-block rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-700"
                >
                  {getTopicMeta(id)?.title ?? id}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}
