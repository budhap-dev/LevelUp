import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

const updateServiceWorker = vi.fn();
let initial = { offlineReady: false, needRefresh: false };

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: useState(initial.offlineReady),
    needRefresh: useState(initial.needRefresh),
    updateServiceWorker,
  }),
}));

const { OfflineBadge, PwaToasts } = await import('./PwaStatus');

describe('PwaToasts', () => {
  beforeEach(() => updateServiceWorker.mockClear());

  it('renders nothing when there is nothing to say', () => {
    initial = { offlineReady: false, needRefresh: false };
    const { container } = render(<PwaToasts />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers to reload when a new version is waiting', async () => {
    initial = { offlineReady: false, needRefresh: true };
    render(<PwaToasts />);
    expect(screen.getByRole('status')).toHaveTextContent('A new version of LevelUp is available.');
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('lets the user postpone an update', async () => {
    initial = { offlineReady: false, needRefresh: true };
    render(<PwaToasts />);
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it('announces offline readiness and hides it after a few seconds', () => {
    vi.useFakeTimers();
    try {
      initial = { offlineReady: true, needRefresh: false };
      render(<PwaToasts />);
      expect(screen.getByRole('status')).toHaveTextContent('ready to use offline');
      act(() => void vi.advanceTimersByTime(6000));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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
