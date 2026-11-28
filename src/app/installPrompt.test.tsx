import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallApp } from './VersionFooter';
import { isIos } from './installPrompt';

function fireInstallable(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('isIos', () => {
  it('recognises iPhones and iPads, including iPadOS reporting itself as a Mac', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIos('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 5)).toBe(false);
  });
});

describe('InstallApp', () => {
  it('shows nothing where the browser offers no way to install', () => {
    const { container } = render(<InstallApp />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers the native prompt once the browser says the app is installable', async () => {
    render(<InstallApp />);
    const event = fireInstallable();
    expect(event.defaultPrevented).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(event.prompt).toHaveBeenCalledOnce();
    // The event works once; the button goes until the browser offers it again.
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('hides once the app is installed', () => {
    render(<InstallApp />);
    fireInstallable();
    expect(screen.getByRole('button', { name: 'Install app' })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });
});

describe('InstallApp on iOS', () => {
  it('explains the Share menu, since iOS has no install prompt', async () => {
    vi.resetModules();
    const ua = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    const { InstallApp: FreshInstallApp } = await import('./VersionFooter');
    render(<FreshInstallApp />);
    const button = screen.getByRole('button', { name: 'Install app' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    ua.mockRestore();
  });
});
