import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { topics } from '@/lib/content';
import type { SearchKind, SearchRecord } from '@/lib/content/schema';
import { highlight, hrefFor, loadSearch, type SearchEngine, type SearchHit } from '@/lib/search';
import { LevelBadge } from '@/components/Badge';

const GROUPS: { kind: SearchKind; label: string; max: number }[] = [
  { kind: 'topic', label: 'Topics', max: 5 },
  { kind: 'question', label: 'Interview questions', max: 8 },
  { kind: 'section', label: 'Sections', max: 6 },
  { kind: 'cheat', label: 'Cheat sheet', max: 6 },
];

const KIND_ICON: Record<SearchKind, string> = {
  topic: 'M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5z M14 3v5h5',
  question: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  section: 'M4 6h16M4 12h16M4 18h10',
  cheat: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
};

function KindIcon({ kind }: { kind: SearchKind }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={KIND_ICON[kind]} />
    </svg>
  );
}

/** When the query is empty, offer the topics that have content. */
const SUGGESTIONS: SearchHit[] = topics
  .filter((t) => t.status !== 'stub')
  .map((t) => ({
    record: { id: t.id, kind: 'topic', topicId: t.id, topicTitle: t.title, title: t.title, text: '', tags: t.tags, level: t.level } satisfies SearchRecord,
    score: 0,
    titleRanges: [],
  }));

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<SearchEngine | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const listId = useId();

  // Open/close the native dialog (modal: traps focus, Escape closes, background inert).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const isOpen = dialog.hasAttribute('open'); // `open` attribute works even where HTMLDialogElement is incomplete
    if (open && !isOpen) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      inputRef.current?.focus();
      inputRef.current?.select();
      loadSearch().then(setEngine, () => setFailed(true));
    } else if (!open && isOpen) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  const sections = useMemo(() => {
    const hits = query.trim().length >= 2 && engine ? engine.search(query) : query.trim() ? [] : SUGGESTIONS;
    // Cap each group while searching; show every suggestion when the query is empty.
    const searching = !!query.trim();
    const groups = GROUPS.map((g) => ({ ...g, hits: hits.filter((h) => h.record.kind === g.kind).slice(0, searching ? g.max : Infinity) })).filter(
      (g) => g.hits.length,
    );
    // Order groups by their best hit, so the first (default-selected) result is the best match overall.
    return searching ? groups.sort((a, b) => a.hits[0]!.score - b.hits[0]!.score) : groups;
  }, [engine, query]);
  const flat = useMemo(() => sections.flatMap((s) => s.hits), [sections]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const go = (hit: SearchHit | undefined) => {
    if (!hit) return;
    onClose();
    navigate(hrefFor(hit.record));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[active]);
    } else if (e.key === 'Escape') {
      // Native dialogs also close on Escape; handling it here covers the non-modal fallback.
      e.preventDefault();
      onClose();
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;
  const loading = !engine && !failed && query.trim().length >= 2;
  let index = -1;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Search"
      onClose={onClose}
      // Clicking the backdrop (the dialog element itself, outside the panel) closes it.
      onClick={(e) => e.target === dialogRef.current && onClose()}
      className="palette m-0 mx-auto mt-3 w-[min(42rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-2xl border border-line bg-surface p-0 text-fg sm:mt-[12vh]"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls={listId}
          aria-activedescendant={flat.length ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-label="Search topics, questions and concepts"
          placeholder="Search topics, questions, concepts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted focus-visible:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-xs text-muted sm:block">Esc</kbd>
      </div>

      <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="max-h-[min(60vh,32rem)] overflow-y-auto overscroll-contain p-2">
        {sections.map((section) => (
          <div key={section.kind} role="group" aria-labelledby={`${listId}-${section.kind}`} className="mb-2 last:mb-0">
            <div id={`${listId}-${section.kind}`} className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
              {query.trim() ? section.label : 'Topics with content'}
            </div>
            {section.hits.map((hit) => {
              index += 1;
              const i = index;
              const isActive = i === active;
              const r = hit.record;
              return (
                <div
                  key={r.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive}
                  onMouseMove={() => !isActive && setActive(i)}
                  onClick={() => go(hit)}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 ${isActive ? 'bg-accent-soft text-accent-ink' : 'text-fg-soft'}`}
                >
                  <span className={`mt-0.5 ${isActive ? 'text-accent-ink' : 'text-muted'}`}>
                    <KindIcon kind={r.kind} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${isActive ? 'text-accent-ink' : 'text-fg'}`}>
                      {highlight(r.title, hit.titleRanges).map((part, j) =>
                        part.match ? (
                          <mark key={j} className="rounded-sm bg-transparent text-inherit underline decoration-accent decoration-2 underline-offset-2">
                            {part.text}
                          </mark>
                        ) : (
                          <span key={j}>{part.text}</span>
                        ),
                      )}
                    </span>
                    <span className={`mt-0.5 block truncate text-xs ${isActive ? 'text-accent-ink' : 'text-muted'}`}>
                      {r.kind === 'topic' ? r.text || r.tags.map((t) => `#${t}`).join(' ') : [r.topicTitle, r.text].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {r.level && (r.kind === 'question' || r.kind === 'topic') && <LevelBadge level={r.level} />}
                </div>
              );
            })}
          </div>
        ))}

        {flat.length === 0 && (
          <p className="px-3 py-10 text-center text-sm text-muted" role="status">
            {failed ? 'Search is unavailable.' : loading ? 'Loading search index…' : `No results for “${query.trim()}”.`}
          </p>
        )}
      </div>

      <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-xs text-muted sm:flex">
        <span>
          <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> to move
        </span>
        <span>
          <kbd className="font-sans">↵</kbd> to open
        </span>
        <span>
          <kbd className="font-sans">Esc</kbd> to close
        </span>
      </div>
    </dialog>
  );
}
