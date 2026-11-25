import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  /** Label of the confirming button, e.g. "Delete note". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` (the default) styles the confirm button for a destructive action. */
  tone?: 'danger' | 'default';
}

interface Request extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * An in-app replacement for `window.confirm`.
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: 'Delete this note?', confirmLabel: 'Delete note' }))) return;
 *   …
 *   return <>{…}{confirmDialog}</>;
 *
 * The dialog renders in a portal on document.body, so it works inside editors and node views.
 */
export function useConfirm() {
  const [request, setRequest] = useState<Request | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })), []);
  const dialog = request && (
    <ConfirmDialog
      {...request}
      onClose={(ok) => {
        request.resolve(ok);
        setRequest(null);
      }}
    />
  );
  return [confirm, dialog] as const;
}

function ConfirmDialog({ title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', tone = 'danger', onClose }: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const done = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d || d.open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', ''); // where <dialog> isn't supported
    cancelRef.current?.focus(); // the safe choice gets focus, so Enter never deletes by accident
  }, []);

  const finish = (ok: boolean) => {
    if (done.current) return;
    done.current = true;
    const d = ref.current;
    if (d?.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
    onClose(ok);
  };

  const button = 'rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2';
  const danger = tone === 'danger';

  return createPortal(
    <dialog
      ref={ref}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={message ? `${id}-desc` : undefined}
      className="palette m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-fg"
      onCancel={(e) => {
        e.preventDefault(); // Escape: close through finish() so the promise resolves
        finish(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) finish(false); // a click on the backdrop
      }}
    >
      <div className="flex gap-4 p-6">
        {danger && (
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle text-danger">
            <Icon name="trash" className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {title}
          </h2>
          {message && (
            <p id={`${id}-desc`} className="mt-2 text-sm break-words text-muted">
              {message}
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
        <button ref={cancelRef} type="button" autoFocus onClick={() => finish(false)} className={`${button} border border-line text-fg-soft hover:bg-subtle hover:text-fg`}>
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => finish(true)}
          className={`${button} ${danger ? 'bg-danger text-on-danger outline-danger hover:opacity-90' : 'bg-accent text-on-accent outline-accent hover:opacity-90'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
