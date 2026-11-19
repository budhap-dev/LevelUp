import { useMemo } from 'react';
import { Link } from 'react-router';
import { getTopicMeta } from '@/lib/content';
import { SECTIONS } from '@/lib/content/constants';
import { useProgress, useProgressController } from '@/lib/progress/react';
import type { Bookmark } from '@/lib/progress/types';
import { BookmarkIcon } from '@/features/topic/TopicToolbar';

const kindOf = (b: Bookmark) => (!b.anchor ? 'Topic' : b.anchor.startsWith('q-') ? 'Question' : 'Section');
const href = (b: Bookmark) => `/topics/${b.topicId}${b.anchor ? `#${b.anchor}` : ''}`;
const sectionTitle = (anchor: string) => SECTIONS.find((s) => s.id === anchor)?.heading;

export function BookmarksPage() {
  const bookmarks = useProgress((d) => d.bookmarks);
  const progress = useProgressController();

  // Group by topic; topics ordered by their most recent bookmark.
  const groups = useMemo(() => {
    const byTopic = new Map<string, Bookmark[]>();
    for (const b of Object.values(bookmarks).sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      byTopic.set(b.topicId, [...(byTopic.get(b.topicId) ?? []), b]);
    }
    return [...byTopic.entries()].map(([topicId, items]) => ({
      topicId,
      title: getTopicMeta(topicId)?.title,
      topicBookmark: items.find((b) => !b.anchor),
      items: items.filter((b) => b.anchor),
    }));
  }, [bookmarks]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-fg">Bookmarks</h1>
      <p className="mt-2 text-muted">Topics and interview questions you've saved. Bookmark a question from its expanded answer.</p>

      {groups.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-line p-10 text-center">
          <BookmarkIcon filled={false} className="size-8 text-muted" />
          <p className="mt-3 font-medium text-fg">No bookmarks yet</p>
          <p className="mt-1 text-sm text-muted">Use the Bookmark button on a topic, or the bookmark icon inside any interview answer.</p>
          <Link to="/topics?content=1" className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-opacity hover:opacity-90">
            Browse topics
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {groups.map((g) => (
            <section key={g.topicId} aria-labelledby={`bm-${g.topicId}`} className="animate-page-in overflow-hidden rounded-xl border border-line bg-surface">
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <h2 id={`bm-${g.topicId}`} className="flex-1 font-semibold text-fg">
                  {g.title ? (
                    <Link to={`/topics/${g.topicId}`} className="hover:text-accent-ink">
                      {g.title}
                    </Link>
                  ) : (
                    <span>
                      {g.topicBookmark?.label ?? g.topicId} <span className="text-sm font-normal text-muted">(no longer available)</span>
                    </span>
                  )}
                </h2>
                {g.topicBookmark && (
                  <button
                    type="button"
                    onClick={() => progress.removeBookmark(g.topicBookmark!.id)}
                    aria-label={`Remove bookmark for ${g.title ?? g.topicBookmark.label}`}
                    title="Remove topic bookmark"
                    className="flex size-8 items-center justify-center rounded-lg text-accent-ink transition-colors hover:bg-subtle"
                  >
                    <BookmarkIcon filled className="size-4.5" />
                  </button>
                )}
              </div>
              {g.items.length > 0 && (
                <ul className="divide-y divide-line">
                  {g.items.map((b) => (
                    <li key={b.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 w-16 shrink-0 text-xs font-medium tracking-wide text-muted uppercase">{kindOf(b)}</span>
                      <Link to={href(b)} className="flex-1 text-sm text-fg-soft transition-colors hover:text-accent-ink">
                        {kindOf(b) === 'Section' ? (sectionTitle(b.anchor!) ?? b.label) : b.label}
                      </Link>
                      <button
                        type="button"
                        onClick={() => progress.removeBookmark(b.id)}
                        aria-label={`Remove bookmark: ${b.label}`}
                        className="-my-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-fg"
                      >
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
                          <path d="M6.3 5.3a1 1 0 0 1 1.4 0L10 7.6l2.3-2.3a1 1 0 1 1 1.4 1.4L11.4 9l2.3 2.3a1 1 0 0 1-1.4 1.4L10 10.4l-2.3 2.3a1 1 0 0 1-1.4-1.4L8.6 9 6.3 6.7a1 1 0 0 1 0-1.4z" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
