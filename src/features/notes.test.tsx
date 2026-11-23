import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '@/app/router';
import { notesStore } from '@/lib/notes/store';
import type { Note, NoteSummary } from '@/lib/notes/types';

const NOTE_ID = '11111111-2222-4333-8444-555555555555';

/** A tiny stand-in for the Notes API: one passphrase, notes kept in memory. */
function fakeApi() {
  let unlocked = false;
  const notes = new Map<string, Note>();
  const calls: string[] = [];
  const reply = (body: unknown, status = 200) => Promise.resolve(new Response(body === null ? null : JSON.stringify(body), { status }));
  const summary = (n: Note): NoteSummary => ({ id: n.id, title: n.title, snippet: n.contentHtml.replace(/<[^>]+>/g, ''), createdAt: n.createdAt, updatedAt: n.updatedAt, attachmentCount: 0 });

  const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'https://levelup.test');
    const method = init.method ?? 'GET';
    calls.push(`${method} ${url.pathname}${url.search}`);
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, string>) : {};
    const path = url.pathname.replace('/api/', '');
    if (path === 'session') {
      if (method === 'POST') {
        if (body.password !== 'open sesame') return reply({ error: 'Wrong passphrase' }, 401);
        unlocked = true;
        return reply(null, 204);
      }
      return unlocked ? reply({ authenticated: true }) : reply({ error: 'Locked' }, 401);
    }
    if (!unlocked) return reply({ error: 'Locked' }, 401);
    if (path === 'notes' && method === 'GET') {
      const q = url.searchParams.get('q')?.toLowerCase() ?? '';
      return reply({ notes: [...notes.values()].filter((n) => `${n.title} ${n.contentHtml}`.toLowerCase().includes(q)).map(summary) });
    }
    if (path === 'notes' && method === 'POST') {
      const now = new Date().toISOString();
      const note: Note = { id: NOTE_ID, title: '', contentHtml: '', createdAt: now, updatedAt: now, attachments: [] };
      notes.set(note.id, note);
      return reply({ note }, 201);
    }
    const note = notes.get(path.replace('notes/', ''));
    if (!note) return reply({ error: 'Not found' }, 404);
    if (method === 'PATCH') Object.assign(note, body, { updatedAt: new Date().toISOString() });
    return reply({ note });
  });
  return { fetchMock, notes, calls };
}

const renderAt = (path: string) => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

describe('notes section', () => {
  let api: ReturnType<typeof fakeApi>;
  beforeEach(() => {
    api = fakeApi();
    vi.stubGlobal('fetch', api.fetchMock);
    notesStore.reset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('has its own sidebar menu and a top-bar button for new notes', async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    api.notes.set(NOTE_ID, { id: NOTE_ID, title: 'Redis eviction', contentHtml: '', createdAt: now, updatedAt: now, attachments: [] });
    renderAt('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'New note' })) expect(link).toHaveAttribute('href', '/notes?new=1');
    // Locked: the menu offers to unlock, then lists recent notes once unlocked.
    await user.click(await within(nav).findByRole('link', { name: 'Unlock notes' }));
    await user.type(await screen.findByLabelText('Passphrase'), 'open sesame{Enter}');
    const recent = await screen.findByRole('list', { name: 'Recent notes' });
    expect(await within(recent).findByRole('link', { name: 'Redis eviction' })).toHaveAttribute('href', `/notes?note=${NOTE_ID}`);
    expect(within(recent).getByRole('link', { name: 'All notes' })).toHaveAttribute('href', '/notes');
  });

  it('opens a fresh note from a New note link, once', async () => {
    const user = userEvent.setup();
    renderAt('/notes?new=1');
    await user.type(await screen.findByLabelText('Passphrase'), 'open sesame{Enter}');
    expect(await screen.findByLabelText('Title')).toHaveFocus();
    expect(api.calls.filter((c) => c === 'POST /api/notes')).toHaveLength(1);
    const recent = screen.getByRole('list', { name: 'Recent notes' });
    expect(within(recent).getByRole('link', { name: 'Untitled' })).toHaveAttribute('aria-current', 'page');
  });

  it('asks for the passphrase, then shows an empty list', async () => {
    const user = userEvent.setup();
    renderAt('/notes');
    await user.type(await screen.findByLabelText('Passphrase'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong passphrase');

    await user.clear(screen.getByLabelText('Passphrase'));
    await user.type(screen.getByLabelText('Passphrase'), 'open sesame');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Notes' })).toBeInTheDocument();
    expect(await screen.findByText('No notes yet')).toBeInTheDocument();
  });

  it('creates a note and autosaves its title', async () => {
    const user = userEvent.setup();
    renderAt('/notes');
    await user.type(await screen.findByLabelText('Passphrase'), 'open sesame{Enter}');
    await user.click(await screen.findByRole('button', { name: 'New note' }));

    const title = await screen.findByLabelText('Title');
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Note body' })).toBeInTheDocument();
    await user.type(title, 'Kafka partitions');

    await waitFor(() => expect(api.notes.get(NOTE_ID)?.title).toBe('Kafka partitions'), { timeout: 3000 });
    expect(await screen.findByText('All changes saved')).toBeInTheDocument();
    // Narrow screens show one pane at a time; go back to the list.
    await user.click(screen.getByRole('button', { name: 'All notes' }));
    const list = await screen.findByRole('list', { name: 'Notes' });
    expect(within(list).getByRole('link', { name: /Kafka partitions/ })).toHaveAttribute('href', `/notes?note=${NOTE_ID}`);
  });

  it('searches notes on the server', async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    api.notes.set(NOTE_ID, { id: NOTE_ID, title: 'Redis eviction', contentHtml: '<p>LRU vs LFU</p>', createdAt: now, updatedAt: now, attachments: [] });
    renderAt('/notes');
    await user.type(await screen.findByLabelText('Passphrase'), 'open sesame{Enter}');
    expect(await within(await screen.findByRole('list', { name: 'Notes' })).findByRole('link', { name: /Redis eviction/ })).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search notes' }), 'postgres');
    expect(await screen.findByText('No notes match')).toBeInTheDocument();
    expect(api.calls).toContain('GET /api/notes?q=postgres');
  });
});
