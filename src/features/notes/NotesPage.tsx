import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { NotesApiError, notesApi } from '@/lib/notes/client';
import { SNIPPET_MARK_END, SNIPPET_MARK_START, type NoteSummary } from '@/lib/notes/types';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { Icon } from './icons';
import { NoteEditor } from './NoteEditor';

type Access = 'checking' | 'locked' | 'unlocked' | { error: string };

/** `?new=1` links (sidebar +, top-bar "New note") already handled, by history entry, so StrictMode/re-renders don't create twice. */
const handledNewLinks = new Set<string>();

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/** The Notes section: a passphrase gate in front of a searchable list and an editor. */
export function NotesPage() {
  const [access, setAccess] = useState<Access>('checking');

  const check = useCallback(() => {
    setAccess('checking');
    notesApi.session().then(
      (ok) => setAccess(ok ? 'unlocked' : 'locked'),
      (e: unknown) => setAccess({ error: message(e) }),
    );
  }, []);
  useEffect(check, [check]);

  if (access === 'checking') {
    return <p className="py-10 text-center text-sm text-muted" aria-busy="true">Opening notes…</p>;
  }
  if (access === 'locked') return <LockScreen onUnlocked={() => setAccess('unlocked')} />;
  if (access === 'unlocked') return <Workspace onLocked={() => setAccess('locked')} />;
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="text-2xl font-semibold text-fg">Notes</h1>
      <p role="alert" className="mt-3 text-fg-soft">{access.error}</p>
      <button type="button" onClick={check} className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90">
        Try again
      </button>
    </div>
  );
}

function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await notesApi.unlock(password);
      onUnlocked();
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-line bg-surface p-6 sm:mt-16">
      <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
        <Icon name="lock" className="size-5" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-fg">Notes are locked</h1>
      <p className="mt-1 text-sm text-muted">Enter your passphrase. This browser stays unlocked for 30 days.</p>
      <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-3">
        <label htmlFor="notes-passphrase" className="block text-sm font-medium text-fg">
          Passphrase
        </label>
        <input
          id="notes-passphrase"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'notes-passphrase-error' : undefined}
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-fg focus:border-accent focus:outline-none"
        />
        {error && (
          <p id="notes-passphrase-error" role="alert" className="text-sm font-medium text-accent-ink">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}

/** Renders a search snippet, turning the API's ⟦…⟧ markers into <mark>. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(${SNIPPET_MARK_START}[^${SNIPPET_MARK_END}]*${SNIPPET_MARK_END})`));
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith(SNIPPET_MARK_START) ? (
          <mark key={i} className="rounded-sm bg-accent-soft px-0.5 text-accent-ink">
            {p.slice(1, -1)}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1 && new Date().getDate() === d.getDate()) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

function Workspace({ onLocked }: { onLocked: () => void }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const selected = params.get('note');
  const wantsNew = params.get('new') === '1';
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [listError, setListError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);

  const onError = useCallback(
    (e: unknown) => {
      if (e instanceof NotesApiError && e.status === 401) onLocked();
      else setListError(message(e));
    },
    [onLocked],
  );

  // Load the list; searches are debounced and earlier ones cancelled.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(
      () => {
        notesApi.list(query, ctrl.signal).then(
          (list) => {
            setNotes(list);
            setListError(null);
            setSearching(false);
          },
          (e: unknown) => {
            if (ctrl.signal.aborted) return;
            onError(e);
            setSearching(false);
          },
        );
      },
      query ? 250 : 0,
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, reloadKey, onError]);

  // Pick up notes added elsewhere (another device, or by Claude) when coming back to the tab.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && setReloadKey((k) => k + 1);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const open = (id: string | null, replace = false) => setParams(id ? { note: id } : {}, { replace });

  const createNote = useCallback(
    async (replace = false) => {
      setCreating(true);
      try {
        const note = await notesApi.create();
        const summary: NoteSummary = { id: note.id, title: '', snippet: '', createdAt: note.createdAt, updatedAt: note.updatedAt, attachmentCount: 0 };
        setNotes((list) => [summary, ...(list ?? [])]);
        setFreshId(note.id);
        setParams({ note: note.id }, { replace });
      } catch (e) {
        onError(e);
      } finally {
        setCreating(false);
      }
    },
    [onError, setParams],
  );

  // Arriving from a "New note" button elsewhere in the app.
  useEffect(() => {
    if (!wantsNew || handledNewLinks.has(location.key)) return;
    handledNewLinks.add(location.key);
    void createNote(true);
  }, [wantsNew, location.key, createNote]);

  const onChanged = useCallback((patch: Partial<NoteSummary> & { id: string }) => {
    setNotes((list) => {
      if (!list) return list;
      const next = list.map((n) => (n.id === patch.id ? { ...n, ...patch } : n));
      return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }, []);

  const onDeleted = (id: string) => {
    setNotes((list) => list?.filter((n) => n.id !== id) ?? null);
    open(null);
  };

  const lock = async () => {
    await notesApi.lock().catch(() => undefined);
    onLocked();
  };

  const showList = isDesktop || !selected;
  const showEditor = isDesktop || !!selected;

  return (
    <div className="mx-auto flex max-w-6xl gap-8">
      {showList && (
        <section aria-labelledby="notes-h" className="w-full shrink-0 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:w-80 lg:self-start lg:overflow-y-auto">
          <div className="flex items-center gap-2">
            <h1 id="notes-h" className="mr-auto text-3xl font-semibold tracking-tight text-fg">
              Notes
            </h1>
            <button
              type="button"
              onClick={() => void lock()}
              aria-label="Lock notes"
              title="Lock notes on this browser"
              className="flex size-9 items-center justify-center rounded-lg text-fg-soft transition-colors hover:bg-subtle hover:text-fg"
            >
              <Icon name="lock" />
            </button>
            <button
              type="button"
              onClick={() => void createNote()}
              disabled={creating}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Icon name="plus" /> New note
            </button>
          </div>

          <div className="relative mt-4">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
              className="w-full rounded-lg border border-line bg-surface py-2 pr-3 pl-9 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {listError && (
            <p role="alert" className="mt-3 text-sm font-medium text-accent-ink">
              {listError}{' '}
              <button type="button" className="underline underline-offset-2" onClick={() => setReloadKey((k) => k + 1)}>
                Retry
              </button>
            </p>
          )}

          <p className="sr-only" aria-live="polite">
            {notes && !searching && query ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} found` : ''}
          </p>

          {notes === null ? (
            <ul aria-busy="true" aria-label="Loading notes" className="mt-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-16 animate-pulse rounded-lg bg-subtle" />
              ))}
            </ul>
          ) : notes.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-line p-6 text-center">
              <Icon name="note" className="mx-auto size-7 text-muted" />
              <p className="mt-2 font-medium text-fg">{query ? 'No notes match' : 'No notes yet'}</p>
              <p className="mt-1 text-sm text-muted">{query ? 'Try fewer or different words.' : 'Create one, or ask Claude to add one for you.'}</p>
            </div>
          ) : (
            <ul aria-label="Notes" className={`mt-4 space-y-1 transition-opacity ${searching ? 'opacity-60' : ''}`}>
              {notes.map((n) => {
                const active = n.id === selected;
                return (
                  <li key={n.id}>
                    <Link
                      to={`?note=${n.id}`}
                      aria-current={active ? 'page' : undefined}
                      className={`block rounded-lg px-3 py-2.5 transition-colors ${active ? 'bg-accent-soft' : 'hover:bg-subtle'}`}
                    >
                      <span className="flex items-baseline gap-2">
                        <span className={`min-w-0 flex-1 truncate text-sm font-medium ${active ? 'text-accent-ink' : 'text-fg'}`}>{n.title || 'Untitled'}</span>
                        <span className="shrink-0 text-xs text-muted">{relativeDate(n.updatedAt)}</span>
                      </span>
                      <span className="mt-0.5 flex items-start gap-2">
                        <span className="line-clamp-2 min-w-0 flex-1 text-xs text-muted">
                          {n.snippet ? <Snippet text={n.snippet} /> : <em>No content</em>}
                        </span>
                        {n.attachmentCount > 0 && (
                          <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted" title={`${n.attachmentCount} attachments`}>
                            <Icon name="paperclip" className="size-3" />
                            {n.attachmentCount}
                            <span className="sr-only"> attachments</span>
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {showEditor && (
        <div className="min-w-0 flex-1">
          {selected ? (
            <NoteEditor
              key={selected}
              noteId={selected}
              autoFocusTitle={selected === freshId}
              onChanged={onChanged}
              onDeleted={onDeleted}
              onBack={isDesktop ? undefined : () => open(null)}
              onLocked={onLocked}
            />
          ) : (
            <div className="flex h-full min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-line p-10 text-center">
              <Icon name="note" className="size-8 text-muted" />
              <p className="mt-3 font-medium text-fg">Select a note, or start a new one</p>
              <p className="mt-1 text-sm text-muted">Notes are saved as you type and kept in your Neon database.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
