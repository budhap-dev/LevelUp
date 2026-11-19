import { useState } from 'react';
import type { TopicMeta } from '@/lib/content/schema';
import { useProgress, useProgressController } from '@/lib/progress/react';
import type { TopicState } from '@/lib/progress/types';
import { scrollToAnchor } from './useActiveSection';

const STATES: { value: TopicState; label: string }[] = [
  { value: 'in-progress', label: 'Learning' },
  { value: 'learned', label: 'Learned' },
  { value: 'needs-revision', label: 'Needs revision' },
];

const ANNOUNCE: Partial<Record<TopicState, string>> = {
  learned: 'Marked as learned',
  'needs-revision': 'Marked as needing revision',
  'in-progress': 'Marked as learning',
};

export function BookmarkIcon({ filled, className = 'size-5' }: { filled: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
    </svg>
  );
}

/** Status (learning / learned / needs revision), bookmark and notes shortcut for a topic. */
export function TopicToolbar({ meta }: { meta: TopicMeta }) {
  const progress = useProgressController();
  const state = useProgress((d) => d.topics[meta.id]?.state);
  const bookmarked = useProgress((d) => !!d.bookmarks[meta.id]);
  const hasNote = useProgress((d) => !!d.notes[meta.id]);
  const [announcement, setAnnouncement] = useState('');
  const current: TopicState = state && state !== 'not-started' ? state : 'in-progress';

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      {meta.status !== 'stub' && (
        <fieldset className="flex rounded-lg border border-line bg-surface p-0.5">
          <legend className="sr-only">Your status for this topic</legend>
          {STATES.map((s) => (
            <label
              key={s.value}
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-fg-soft transition-colors duration-200 hover:text-fg has-checked:bg-accent has-checked:font-medium has-checked:text-on-accent has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name={`state-${meta.id}`}
                value={s.value}
                checked={current === s.value}
                onChange={() => {
                  progress.setTopicState(meta.id, s.value);
                  setAnnouncement(ANNOUNCE[s.value] ?? '');
                }}
                className="sr-only"
              />
              {s.value === 'learned' && current === 'learned' && (
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 animate-pop-in" fill="currentColor">
                  <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
                </svg>
              )}
              {s.label}
            </label>
          ))}
        </fieldset>
      )}

      <button
        type="button"
        aria-pressed={bookmarked}
        onClick={() => {
          const added = progress.toggleBookmark({ topicId: meta.id, label: meta.title });
          setAnnouncement(added ? 'Bookmarked' : 'Bookmark removed');
        }}
        className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors duration-200 ${
          bookmarked ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-fg-soft hover:border-accent hover:text-fg'
        }`}
      >
        <BookmarkIcon filled={bookmarked} className={`size-4 ${bookmarked ? 'animate-pop-in' : ''}`} />
        {bookmarked ? 'Bookmarked' : 'Bookmark'}
      </button>

      <a
        href="#notes"
        onClick={(e) => {
          e.preventDefault();
          scrollToAnchor('notes');
          document.getElementById('notes-input')?.focus({ preventScroll: true });
        }}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm text-fg-soft transition-colors hover:border-accent hover:text-fg"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
        </svg>
        {hasNote ? 'Your notes' : 'Add notes'}
        {hasNote && <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />}
      </a>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
