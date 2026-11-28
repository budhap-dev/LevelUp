import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { APP_COMMIT, APP_VERSION, builtAtLabel } from '@/lib/version';
import { promptInstall, useInstallState } from './installPrompt';
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
      <InstallApp />
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

/** Matches the sidebar's nav rows (Sidebar rowClass and RowIcon), so it lines up with Settings above it. */
const ROW =
  'group/link flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm text-fg-soft transition-[scale,background-color,color] duration-200 ease-(--ease-out-expo) hover:bg-subtle hover:text-fg active:scale-[0.98]';

function PhoneIcon() {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center text-muted transition-[color,scale] duration-300 ease-(--ease-out-expo) group-hover/link:scale-110 group-hover/link:text-fg-soft">
      <Icon name="phone" className="size-4.5" />
    </span>
  );
}

/**
 * "Install app": the native prompt where the browser offers one (Android, desktop Chromium), Share-menu
 * instructions on iOS, and nothing once installed or where installing isn't possible.
 */
export function InstallApp() {
  const state = useInstallState();
  const [showHelp, setShowHelp] = useState(false);

  if (state === 'prompt') {
    return (
      <div className="-mx-2.5 animate-pop-in">
        <button type="button" onClick={() => void promptInstall()} className={ROW}>
          <PhoneIcon />
          <span className="flex-1">Install app</span>
        </button>
      </div>
    );
  }
  if (state !== 'ios') return null;
  return (
    <div className="-mx-2.5">
      <button type="button" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp} aria-controls="install-help" className={ROW}>
        <PhoneIcon />
        <span className="flex-1">Install app</span>
        <Icon name="chevron" className={`size-3.5 transition-transform duration-200 ${showHelp ? 'rotate-90' : ''}`} />
      </button>
      {showHelp && (
        <p id="install-help" className="mx-2.5 mt-1 mb-1.5 animate-pop-in rounded-lg bg-subtle px-3 py-2 text-xs leading-relaxed text-fg-soft">
          Tap <Icon name="share" className="inline size-3.5 align-[-2px]" /> <strong className="text-fg">Share</strong>, then{' '}
          <strong className="text-fg">Add to Home Screen</strong>. You'll enter the passphrase once in the installed app.
        </p>
      )}
    </div>
  );
}
