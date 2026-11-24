import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { APP_COMMIT, APP_VERSION, builtAtLabel } from '@/lib/version';
import { usePwa } from './PwaStatus';

type CheckState = 'idle' | 'checking' | 'latest' | 'error';
const CHECK_LABEL: Record<CheckState, string> = {
  idle: 'Check for updates',
  checking: 'Checking…',
  latest: 'Up to date',
  error: "Couldn't check",
};

/** Sidebar footer: the running version, a manual update check, and a Reload button once a new version is waiting. */
export function VersionFooter() {
  const { needRefresh, reload, canCheck, checkForUpdates } = usePwa();
  const [check, setCheck] = useState<CheckState>('idle');

  // "Up to date" / "Couldn't check" fade back to the link after a moment.
  useEffect(() => {
    if (check !== 'latest' && check !== 'error') return;
    const t = setTimeout(() => setCheck('idle'), 3000);
    return () => clearTimeout(t);
  }, [check]);

  const runCheck = async () => {
    setCheck('checking');
    try {
      const result = await checkForUpdates();
      // 'found': the worker installs, needRefresh flips and the Reload button replaces this link.
      setCheck(result === 'none' ? 'latest' : 'idle');
    } catch {
      setCheck('error');
    }
  };

  return (
    <div className="space-y-1.5 px-2.5 pt-1.5 pb-0.5">
      {needRefresh && (
        <button
          type="button"
          onClick={reload}
          className="flex w-full animate-pop-in items-center gap-2.5 rounded-lg bg-accent-soft px-2.5 py-2 text-left text-sm font-medium text-accent-ink transition-[scale,background-color] duration-200 ease-(--ease-out-expo) hover:bg-subtle active:scale-[0.98]"
        >
          <span aria-hidden="true" className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative size-2 rounded-full bg-accent" />
          </span>
          <span className="flex-1">New version ready</span>
          <span className="flex items-center gap-1 text-xs">
            Reload <Icon name="redo" className="size-3.5" />
          </span>
        </button>
      )}
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span title={`Built ${builtAtLabel}`}>
          v{APP_VERSION} · <span className="font-mono">{APP_COMMIT}</span>
        </span>
        {!needRefresh && canCheck && (
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={check === 'checking'}
            aria-live="polite"
            className="rounded px-1 transition-colors hover:text-fg disabled:cursor-wait"
          >
            {CHECK_LABEL[check]}
          </button>
        )}
      </div>
    </div>
  );
}
