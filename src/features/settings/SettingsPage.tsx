import { useId, useRef, useState, type ReactNode } from 'react';
import { useProgress, useProgressController, useSaveStatus } from '@/lib/progress/react';
import { ProgressFormatError } from '@/lib/progress/normalise';
import type { ProgressData } from '@/lib/progress/types';

function counts(d: ProgressData) {
  const topics = Object.values(d.topics);
  return {
    learned: topics.filter((t) => t.state === 'learned').length,
    revising: topics.filter((t) => t.state === 'needs-revision').length,
    tracked: topics.length,
    bookmarks: Object.keys(d.bookmarks).length,
    notes: Object.keys(d.notes).length,
    reviews: Object.keys(d.reviews).length,
  };
}

function Card({ title, description, children, tone }: { title: string; description?: string; children: ReactNode; tone?: 'danger' }) {
  const id = useId(); // titles contain spaces, which would break aria-labelledby
  return (
    <section
      aria-labelledby={id}
      className={`rounded-xl border bg-surface p-5 sm:p-6 ${tone === 'danger' ? 'border-red-300 dark:border-red-900' : 'border-line'}`}
    >
      <h2 id={id} className="text-lg font-semibold text-fg">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

const button = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-50';
const primary = `${button} bg-accent text-on-accent hover:opacity-90`;
const secondary = `${button} border border-line bg-surface text-fg hover:border-accent`;

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsPage() {
  const progress = useProgressController();
  const data = useProgress((d) => d);
  const status = useSaveStatus();
  const c = counts(data);

  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ name: string; data: ProgressData; dropped: number } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const resetRef = useRef<HTMLDialogElement>(null);

  const onFile = async (file: File | undefined) => {
    setError('');
    setMessage('');
    setPreview(null);
    if (!file) return;
    try {
      const result = progress.previewImport(await file.text());
      setPreview({ name: file.name, ...result });
      setMode('merge');
    } catch (e) {
      setError(e instanceof ProgressFormatError ? e.message : 'Could not read that file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const applyImport = () => {
    if (!preview) return;
    progress.applyImport(preview.data, mode);
    setMessage(mode === 'merge' ? `Merged progress from ${preview.name}.` : `Replaced your progress with ${preview.name}.`);
    setPreview(null);
  };

  const p = preview && counts(preview.data);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-fg">Settings</h1>
        <p className="mt-2 text-muted">Your progress, bookmarks and notes are stored in this browser only. Export them to back up or move to another device.</p>
      </div>

      <Card title="Your data">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(
            [
              ['Topics learned', c.learned],
              ['Needs revision', c.revising],
              ['Topics started', c.tracked],
              ['Bookmarks', c.bookmarks],
              ['Notes', c.notes],
              ['Review cards', c.reviews],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg bg-subtle p-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold text-fg tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className={`mt-4 text-sm ${status.state === 'error' ? 'text-red-700 dark:text-red-300' : 'text-muted'}`} role={status.state === 'error' ? 'alert' : 'status'}>
          {status.state === 'error'
            ? `Couldn't save to this browser (${status.error}). Storage may be full or blocked. Export a backup now.`
            : status.state === 'pending'
              ? 'Saving…'
              : status.savedAt
                ? `All changes saved at ${new Date(status.savedAt).toLocaleTimeString()}.`
                : 'All changes are saved automatically.'}
        </p>
      </Card>

      <Card title="Backup & restore" description="Export downloads a JSON file. Import lets you preview the file, then merge it with or replace your current progress.">
        <div className="flex flex-wrap gap-3">
          <button type="button" className={primary} onClick={() => download(`levelup-progress-${new Date().toISOString().slice(0, 10)}.json`, progress.exportJson())}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
            </svg>
            Export progress
          </button>
          <label className={`${secondary} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-accent`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4m0 0-4 4m4-4 4 4M5 20h14" />
            </svg>
            Import from file…
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-4 rounded-lg bg-accent-soft p-3 text-sm text-accent-ink">
            {message}
          </p>
        )}

        {preview && p && (
          <div className="mt-5 animate-pop-in rounded-lg border border-line bg-canvas p-4" aria-label="Import preview" role="region">
            <p className="text-sm text-fg">
              <span className="font-medium">{preview.name}</span> contains {p.tracked} topics ({p.learned} learned), {p.bookmarks} bookmarks, {p.notes} notes and {p.reviews}{' '}
              review cards.
            </p>
            {preview.dropped > 0 && (
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
                {preview.dropped} invalid {preview.dropped === 1 ? 'entry' : 'entries'} will be skipped.
              </p>
            )}
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">How to import</legend>
              {(
                [
                  ['merge', 'Merge', 'Keep both; where both have the same item, the most recently changed one wins.'],
                  ['replace', 'Replace', 'Discard your current progress and use the file instead.'],
                ] as const
              ).map(([value, label, help]) => (
                <label key={value} className="flex cursor-pointer gap-3 rounded-lg border border-line p-3 has-checked:border-accent has-checked:bg-accent-soft">
                  <input type="radio" name="import-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 accent-(--accent)" />
                  <span>
                    <span className="block text-sm font-medium text-fg">{label}</span>
                    <span className="block text-sm text-muted">{help}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="mt-4 flex gap-3">
              <button type="button" className={primary} onClick={applyImport}>
                {mode === 'merge' ? 'Merge progress' : 'Replace progress'}
              </button>
              <button type="button" className={secondary} onClick={() => setPreview(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Reset" description="Delete all progress, bookmarks, notes and review history from this browser." tone="danger">
        <button
          type="button"
          className={`${button} border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950`}
          onClick={() => {
            const d = resetRef.current;
            if (typeof d?.showModal === 'function') d.showModal();
            else d?.setAttribute('open', '');
          }}
        >
          Reset all progress…
        </button>
      </Card>

      <dialog
        ref={resetRef}
        role="alertdialog"
        aria-labelledby="reset-title"
        aria-describedby="reset-desc"
        className="palette m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-6 text-fg"
      >
        <h2 id="reset-title" className="text-lg font-semibold">
          Reset all progress?
        </h2>
        <p id="reset-desc" className="mt-2 text-sm text-muted">
          This permanently deletes {c.tracked} topic statuses, {c.bookmarks} bookmarks and {c.notes} notes from this browser. Export a backup first if you might want them back.
        </p>
        <form method="dialog" className="mt-6 flex justify-end gap-3">
          <button value="cancel" className={secondary} autoFocus>
            Cancel
          </button>
          <button
            value="reset"
            className={`${button} bg-red-700 text-white hover:bg-red-800`}
            onClick={() => {
              progress.reset();
              setMessage('All progress was reset.');
              resetRef.current?.removeAttribute('open'); // fallback where <dialog> isn't supported
            }}
          >
            Reset everything
          </button>
        </form>
      </dialog>
    </div>
  );
}
