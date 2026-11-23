import { useCallback, useEffect, useRef, useState } from 'react';
import { NotesApiError, formatBytes, notesApi } from '@/lib/notes/client';
import type { AttachmentMeta, Note, NoteInput, NoteSummary } from '@/lib/notes/types';
import { Icon } from './icons';
import { RichTextEditor } from './RichTextEditor';

const SAVE_DELAY_MS = 800;

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface Props {
  noteId: string;
  autoFocusTitle?: boolean;
  /** Called after each save or attachment change so the list can update without refetching. */
  onChanged: (summary: Partial<NoteSummary> & { id: string }) => void;
  onDeleted: (id: string) => void;
  onBack?: () => void;
  onLocked: () => void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function NoteEditor({ noteId, autoFocusTitle, onChanged, onDeleted, onBack, onLocked }: Props) {
  const [note, setNote] = useState<Note | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [uploading, setUploading] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [save, setSave] = useState<{ state: SaveState; error?: string }>({ state: 'idle' });
  const [dragging, setDragging] = useState(false);

  const pending = useRef<NoteInput>({});
  const latestText = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const fileInput = useRef<HTMLInputElement>(null);
  const callbacks = useRef({ onChanged, onLocked });
  callbacks.current = { onChanged, onLocked };

  const handleError = useCallback((e: unknown) => {
    if (e instanceof NotesApiError && e.status === 401) callbacks.current.onLocked();
  }, []);

  useEffect(() => {
    let cancelled = false;
    notesApi.get(noteId).then(
      (n) => {
        if (cancelled) return;
        setNote(n);
        setTitle(n.title);
        setAttachments(n.attachments);
      },
      (e: unknown) => {
        if (cancelled) return;
        handleError(e);
        setLoadError(message(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [noteId, handleError]);

  /** Sends whatever is pending. Saves run one at a time so they land in order. */
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    queue.current = queue.current.then(async () => {
      const input = pending.current;
      if (!Object.keys(input).length) return;
      pending.current = {};
      const text = latestText.current;
      setSave({ state: 'saving' });
      try {
        const saved = await notesApi.update(noteId, input);
        setSave(Object.keys(pending.current).length ? { state: 'pending' } : { state: 'saved' });
        callbacks.current.onChanged({
          id: noteId,
          title: saved.title,
          updatedAt: saved.updatedAt,
          ...(text !== null ? { snippet: text.slice(0, 240) } : {}),
        });
      } catch (e) {
        pending.current = { ...input, ...pending.current }; // keep it for the next attempt
        handleError(e);
        setSave({ state: 'error', error: message(e) });
      }
    });
    return queue.current;
  }, [noteId, handleError]);

  const schedule = useCallback(
    (patch: NoteInput) => {
      pending.current = { ...pending.current, ...patch };
      setSave({ state: 'pending' });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  // Save on leaving the note; warn before closing the tab with unsaved edits.
  useEffect(() => () => void flush(), [flush]);
  const unsaved = save.state === 'pending' || save.state === 'saving' || save.state === 'error';
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const onContent = useCallback(
    (html: string, text: string) => {
      latestText.current = text;
      schedule({ contentHtml: html });
    },
    [schedule],
  );

  const upload = useCallback(
    async (files: File[]) => {
      setFileError(null);
      for (const file of files) {
        setUploading((u) => [...u, file.name]);
        try {
          const a = await notesApi.attach(noteId, file);
          setAttachments((list) => {
            const next = [...list, a];
            callbacks.current.onChanged({ id: noteId, attachmentCount: next.length, updatedAt: a.createdAt });
            return next;
          });
        } catch (e) {
          handleError(e);
          setFileError(message(e));
        } finally {
          setUploading((u) => {
            const i = u.indexOf(file.name);
            return i < 0 ? u : [...u.slice(0, i), ...u.slice(i + 1)];
          });
        }
      }
    },
    [noteId, handleError],
  );

  const removeAttachment = async (a: AttachmentMeta) => {
    if (!window.confirm(`Delete “${a.filename}”?`)) return;
    try {
      await notesApi.removeAttachment(a.id);
      setAttachments((list) => {
        const next = list.filter((x) => x.id !== a.id);
        callbacks.current.onChanged({ id: noteId, attachmentCount: next.length });
        return next;
      });
    } catch (e) {
      handleError(e);
      setFileError(message(e));
    }
  };

  const deleteNote = async () => {
    if (!window.confirm(`Delete “${title || 'Untitled'}” and its attachments? This can’t be undone.`)) return;
    clearTimeout(timer.current);
    pending.current = {};
    try {
      await notesApi.remove(noteId);
      onDeleted(noteId);
    } catch (e) {
      handleError(e);
      setSave({ state: 'error', error: message(e) });
    }
  };

  const backButton = onBack && (
    <button type="button" onClick={onBack} className="-ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-fg-soft hover:bg-subtle hover:text-fg">
      <Icon name="back" /> All notes
    </button>
  );

  if (loadError) {
    return (
      <div className="py-10">
        {backButton}
        <p role="alert" className="mt-6 rounded-xl border border-line bg-surface p-6 text-fg-soft">
          {loadError}
        </p>
      </div>
    );
  }
  if (!note) {
    return (
      <div aria-busy="true" aria-label="Loading note" className="animate-pulse space-y-4 py-2">
        <div className="h-9 w-2/3 rounded-lg bg-subtle" />
        <div className="h-10 rounded-lg bg-subtle" />
        <div className="h-48 rounded-lg bg-subtle" />
      </div>
    );
  }

  const statusText = {
    idle: `Edited ${formatDate(note.updatedAt)}`,
    pending: 'Unsaved changes',
    saving: 'Saving…',
    saved: 'All changes saved',
    error: `Couldn’t save: ${save.error ?? ''}`,
  }[save.state];

  return (
    <article
      aria-label={title || 'Untitled note'}
      className="relative"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        setDragging(false);
        if (e.defaultPrevented || !e.dataTransfer.files.length) return;
        e.preventDefault();
        void upload([...e.dataTransfer.files]);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {backButton}
        <p aria-live="polite" className={`mr-auto text-xs ${save.state === 'error' ? 'font-medium text-accent-ink' : 'text-muted'}`}>
          {statusText}
          {save.state === 'error' && (
            <button type="button" onClick={() => void flush()} className="ml-2 underline underline-offset-2">
              Retry
            </button>
          )}
        </p>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-fg-soft transition-colors hover:bg-subtle hover:text-fg"
        >
          <Icon name="paperclip" /> Attach
        </button>
        <button
          type="button"
          onClick={() => void deleteNote()}
          aria-label="Delete note"
          title="Delete note"
          className="flex size-8 items-center justify-center rounded-lg text-fg-soft transition-colors hover:bg-subtle hover:text-fg"
        >
          <Icon name="trash" />
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          aria-label="Attach files"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (files.length) void upload(files);
          }}
        />
      </div>

      <label htmlFor="note-title" className="sr-only">
        Title
      </label>
      <input
        id="note-title"
        value={title}
        autoFocus={autoFocusTitle}
        maxLength={300}
        placeholder="Untitled"
        onChange={(e) => {
          setTitle(e.target.value);
          schedule({ title: e.target.value });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            document.querySelector<HTMLElement>('.notes-editor [contenteditable]')?.focus();
          }
        }}
        className="mt-4 w-full bg-transparent text-3xl font-semibold tracking-tight text-fg placeholder:text-muted focus:outline-none"
      />
      <p className="mt-1 mb-4 text-xs text-muted">Created {formatDate(note.createdAt)}</p>

      <RichTextEditor key={note.id} initialHtml={note.contentHtml} onChange={onContent} onFiles={(f) => void upload(f)} label="Note body" />

      <section aria-labelledby="attachments-h" className="mt-6 border-t border-line pt-4">
        <h2 id="attachments-h" className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Icon name="paperclip" /> Attachments
          {attachments.length > 0 && <span className="font-normal text-muted">{attachments.length}</span>}
        </h2>
        {fileError && (
          <p role="alert" className="mt-2 text-sm font-medium text-accent-ink">
            {fileError}
          </p>
        )}
        {attachments.length === 0 && uploading.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Drop files here, paste them into the note, or use Attach. Up to 4 MB each.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2">
                {a.contentType.startsWith('image/') && !a.contentType.includes('svg') ? (
                  <img src={notesApi.attachmentUrl(a.id)} alt="" loading="lazy" className="size-10 shrink-0 rounded-md bg-subtle object-cover" />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-subtle text-muted">
                    <Icon name="file" className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={notesApi.attachmentUrl(a.id)}
                    target="_blank"
                    rel="noopener"
                    className="block truncate text-sm font-medium text-fg hover:text-accent-ink"
                    title={a.filename}
                  >
                    {a.filename}
                  </a>
                  <span className="text-xs text-muted">{formatBytes(a.size)}</span>
                </div>
                <a
                  href={notesApi.attachmentUrl(a.id, true)}
                  download={a.filename}
                  aria-label={`Download ${a.filename}`}
                  title="Download"
                  className="flex size-8 items-center justify-center rounded-lg text-fg-soft hover:bg-subtle hover:text-fg"
                >
                  <Icon name="download" />
                </a>
                <button
                  type="button"
                  onClick={() => void removeAttachment(a)}
                  aria-label={`Delete ${a.filename}`}
                  title="Delete attachment"
                  className="flex size-8 items-center justify-center rounded-lg text-fg-soft hover:bg-subtle hover:text-fg"
                >
                  <Icon name="x" />
                </button>
              </li>
            ))}
            {uploading.map((name, i) => (
              <li key={`up-${i}`} aria-busy="true" className="flex animate-pulse items-center gap-3 rounded-lg border border-dashed border-line p-2 text-sm text-muted">
                <span className="size-10 shrink-0 rounded-md bg-subtle" />
                <span className="truncate">Uploading {name}…</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent-soft text-sm font-medium text-accent-ink"
        >
          Drop to attach
        </div>
      )}
    </article>
  );
}
