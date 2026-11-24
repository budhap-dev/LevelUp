import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState, type ReactNode } from 'react';

const updateServiceWorker = vi.fn();
let initial = { offlineReady: false, needRefresh: false };
/** null = no service worker (dev, unsupported browsers). */
let registration: { update: ReturnType<typeof vi.fn>; installing: unknown; waiting: unknown } | null = null;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: { onRegisteredSW?: (url: string, r: unknown) => void }) => {
    useEffect(() => {
      if (registration) options.onRegisteredSW?.('/sw.js', registration);
    }, []);
    return {
      offlineReady: useState(initial.offlineReady),
      needRefresh: useState(initial.needRefresh),
      updateServiceWorker,
    };
  },
}));

const { OfflineBadge, PwaProvider, PwaToasts } = await import('./PwaStatus');
const { VersionFooter } = await import('./VersionFooter');

const withPwa = (ui: ReactNode) => render(<PwaProvider>{ui}</PwaProvider>);

describe('PwaToasts', () => {
  beforeEach(() => {
    updateServiceWorker.mockClear();
    registration = null;
  });

  it('renders nothing when there is nothing to say', () => {
    initial = { offlineReady: false, needRefresh: false };
    withPwa(<PwaToasts />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('offers to reload when a new version is waiting, naming the running version', async () => {
    initial = { offlineReady: false, needRefresh: true };
    withPwa(<PwaToasts />);
    expect(screen.getByRole('status')).toHaveTextContent('A new version of LevelUp is available.');
    expect(screen.getByRole('status')).toHaveTextContent(`You're on v${__APP_VERSION__} · ${__APP_COMMIT__}`);
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('lets the user postpone an update; the footer keeps a Reload button', async () => {
    initial = { offlineReady: false, needRefresh: true };
    withPwa(
      <>
        <PwaToasts />
        <VersionFooter />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(updateServiceWorker).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /New version ready/ }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('announces offline readiness and hides it after a few seconds', () => {
    vi.useFakeTimers();
    try {
      initial = { offlineReady: true, needRefresh: false };
      withPwa(<PwaToasts />);
      expect(screen.getByRole('status')).toHaveTextContent('ready to use offline');
      act(() => void vi.advanceTimersByTime(6000));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('VersionFooter', () => {
  beforeEach(() => {
    initial = { offlineReady: false, needRefresh: false };
    registration = null;
  });

  it('shows the running version and commit', () => {
    withPwa(<VersionFooter />);
    expect(screen.getByText(`v${__APP_VERSION__} ·`, { exact: false })).toHaveTextContent(__APP_COMMIT__);
  });

  it('hides the update check without a service worker', () => {
    withPwa(<VersionFooter />);
    expect(screen.queryByRole('button', { name: 'Check for updates' })).not.toBeInTheDocument();
  });

  it('checks for updates on demand and reports when already up to date', async () => {
    registration = { update: vi.fn().mockResolvedValue(undefined), installing: null, waiting: null };
    withPwa(<VersionFooter />);
    await userEvent.click(await screen.findByRole('button', { name: 'Check for updates' }));
    expect(registration.update).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Up to date' })).toBeInTheDocument();
  });
});

describe('OfflineBadge', () => {
  const setOnline = (value: boolean) => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  };
  afterEach(() => setOnline(true));

  it('appears while offline and disappears when the connection returns', () => {
    render(<OfflineBadge />);
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
    act(() => setOnline(false));
    expect(screen.getByText('Offline')).toBeInTheDocument();
    act(() => setOnline(true));
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });
});
