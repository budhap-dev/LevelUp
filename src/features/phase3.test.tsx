import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '@/app/router';
import { PROGRESS_STORAGE_KEY } from '@/lib/progress/local-storage-store';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

const stored = () => JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? 'null');
const sidebar = () => document.getElementById('sidebar')!;

beforeEach(() => localStorage.clear());

describe('topic progress', () => {
  it('marks a visited topic in progress, lets you mark it learned, and remembers it', async () => {
    const user = userEvent.setup();
    const first = renderAt('/topics/caching');
    await screen.findByRole('heading', { level: 1, name: 'Caching' });

    expect(screen.getByRole('radio', { name: 'Learning' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Learned' }));
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Marked as learned');
    expect(within(sidebar()).getByRole('link', { name: 'Caching (Learned)' })).toBeInTheDocument();

    await waitFor(() => expect(stored()?.topics.caching.state).toBe('learned'));
    first.unmount();

    renderAt('/topics/caching');
    await screen.findByRole('heading', { level: 1, name: 'Caching' });
    expect(screen.getByRole('radio', { name: 'Learned' })).toBeChecked();
  });

  it('does not track progress for stub topics', async () => {
    renderAt('/topics/javascript');
    await screen.findByRole('heading', { level: 1, name: 'JavaScript' });
    expect(screen.queryByRole('radio', { name: 'Learned' })).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 400));
    expect(stored()?.topics?.javascript).toBeUndefined();
  });

  it('shows "continue where you left off" on the dashboard', async () => {
    const view = renderAt('/topics/observability-sre');
    await screen.findByRole('heading', { level: 1, name: 'Observability & SRE' });
    view.unmount();
    renderAt('/');
    const resume = await screen.findByRole('link', { name: /Continue where you left off/ });
    expect(resume).toHaveTextContent('Observability & SRE');
    expect(resume).toHaveAttribute('href', '/topics/observability-sre#tldr');
  });
});

describe('bookmarks and notes', () => {
  it('bookmarks a topic and a question, lists them, and removes them', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/topics/caching');
    await screen.findByRole('heading', { level: 1, name: 'Caching' });

    await user.click(screen.getByRole('button', { name: 'Bookmark' }));
    expect(screen.getByRole('button', { name: 'Bookmarked' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByText('What is a cache stampede and how do you prevent it?'));
    const stampede = document.getElementById('q-cache-stampede')!;
    await user.click(within(stampede).getByRole('button', { name: 'Bookmark this question' }));

    await router.navigate('/bookmarks');
    const section = await screen.findByRole('region', { name: 'Caching' });
    const question = within(section).getByRole('link', { name: 'What is a cache stampede and how do you prevent it?' });
    expect(question).toHaveAttribute('href', '/topics/caching#q-cache-stampede');

    await user.click(within(section).getByRole('button', { name: /Remove bookmark: What is a cache stampede/ }));
    await user.click(within(section).getByRole('button', { name: 'Remove bookmark for Caching' }));
    expect(await screen.findByText('No bookmarks yet')).toBeInTheDocument();
  });

  it('autosaves notes and keeps them across visits', async () => {
    const user = userEvent.setup();
    const first = renderAt('/topics/caching');
    const notes = await screen.findByRole('textbox', { name: 'Your notes for this topic' });
    await user.type(notes, 'Delete on write, never update.');
    await waitFor(() => expect(stored()?.notes.caching.body).toBe('Delete on write, never update.'), { timeout: 3000 });
    expect(screen.queryByRole('link', { name: 'Add notes' })).not.toBeInTheDocument(); // toolbar now says "Your notes"
    first.unmount();

    renderAt('/topics/caching');
    expect(await screen.findByRole('textbox', { name: 'Your notes for this topic' })).toHaveValue('Delete on write, never update.');
  });

  it('saves a note typed just before leaving the page', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/topics/caching');
    await user.type(await screen.findByRole('textbox', { name: 'Your notes for this topic' }), 'quick');
    await router.navigate('/'); // before the autosave delay
    await waitFor(() => expect(stored()?.notes.caching.body).toBe('quick'));
  });
});

describe('settings: export, reset, import', () => {
  it('round-trips progress through an exported file', async () => {
    const user = userEvent.setup();
    let exported = '';
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob.text().then((t) => (exported = t));
      return 'blob:test';
    });
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    // Some progress to back up.
    const { router } = renderAt('/topics/caching');
    await screen.findByRole('heading', { level: 1, name: 'Caching' });
    await user.click(screen.getByRole('radio', { name: 'Needs revision' }));
    await user.click(screen.getByRole('button', { name: 'Bookmark' }));

    await router.navigate('/settings');
    await user.click(await screen.findByRole('button', { name: 'Export progress' }));
    await waitFor(() => expect(exported).toContain('"needs-revision"'));
    expect(click).toHaveBeenCalled();

    // Reset (confirm in the dialog).
    await user.click(screen.getByRole('button', { name: 'Reset all progress…' }));
    await user.click(screen.getByRole('button', { name: 'Reset everything' }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Your data' })).getAllByText('0')).toHaveLength(6));

    // Import the export: preview, then merge.
    const file = new File([exported], 'backup.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Import from file…'), file);
    const preview = await screen.findByRole('region', { name: 'Import preview' });
    expect(preview).toHaveTextContent('backup.json contains 1 topics (0 learned), 1 bookmarks');
    await user.click(within(preview).getByRole('button', { name: 'Merge progress' }));
    expect(await screen.findByText('Merged progress from backup.json.')).toBeInTheDocument();

    await waitFor(() => expect(stored()?.topics.caching.state).toBe('needs-revision'));
    expect(stored()?.bookmarks.caching).toBeDefined();
    click.mockRestore();
  });

  it('rejects files that are not progress backups', async () => {
    const user = userEvent.setup();
    renderAt('/settings');
    await user.upload(await screen.findByLabelText('Import from file…'), new File(['{"name":"package"}'], 'package.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not a LevelUp progress file.');
  });
});
