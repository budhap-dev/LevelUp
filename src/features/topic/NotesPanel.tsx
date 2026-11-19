import { useEffect, useRef, useState } from 'react';
import { useProgress, useProgressController } from '@/lib/progress/react';

const SAVE_DELAY_MS = 600;

function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Personal notes for a topic, saved automatically as you type. */
export function NotesPanel({ topicId }: { topicId: string }) {
  const progress = useProgressController();
  const note = useProgress((d) => d.notes[topicId]);
  const [draft, setDraft] = useState(note?.body ?? '');
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Pick up changes made elsewhere (another tab, an import) when not mid-edit.
  useEffect(() => {
    if (!dirty) setDraft(note?.body ?? '');
  }, [note?.body, dirty]);

  const commit = (value: string) => {
    clearTimeout(timer.current);
    progress.saveNote(topicId, value);
    setDirty(false);
  };

  // Save a pending edit if the user navigates away before the debounce fires.
  const pending = useRef<string | null>(null);
  pending.current = dirty ? draft : null;
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current !== null) progress.saveNote(topicId, pending.current);
    },
    [progress, topicId],
  );

  return (
    <section id="notes" aria-labelledby="notes-h" className="mt-12 scroll-mt-32">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 id="notes-h" className="text-2xl font-semibold tracking-tight text-fg">
          Your notes
        </h2>
        <span className="text-xs text-muted" aria-live="polite">
          {dirty ? 'Saving…' : note ? `Saved ${relativeTime(note.updatedAt)}` : 'Private to this browser'}
        </span>
      </div>
      <label htmlFor="notes-input" className="sr-only">
        Your notes for this topic
      </label>
      <textarea
        id="notes-input"
        value={draft}
        onChange={(e) => {
          const value = e.target.value;
          setDraft(value);
          setDirty(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(value), SAVE_DELAY_MS);
        }}
        onBlur={() => dirty && commit(draft)}
        placeholder="What clicked, what didn't, examples from your own work, questions to follow up…"
        rows={5}
        className="mt-4 block min-h-32 w-full resize-y rounded-xl border border-line bg-surface p-4 text-[0.95rem] leading-relaxed text-fg transition-colors placeholder:text-muted hover:border-accent focus-visible:border-accent [field-sizing:content]"
      />
    </section>
  );
}
