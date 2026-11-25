import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '@/app/router';
import type { AttachmentMeta, Note, NoteSummary } from '@/lib/notes/types';

const NOTE_ID = '11111111-2222-4333-8444-555555555555';

vi.mock('@/lib/mermaid', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/mermaid')>()),
  renderMermaidSvg: vi.fn(async (source: string) => `<svg data-testid="mermaid-svg"><text>${source.split('\n').length} lines</text></svg>`),
}));

/** A tiny stand-in for the Notes API: one passphrase, notes kept in memory. */
function fakeApi() {
  let unlocked = false;
  const notes = new Map<string, Note>();
  const calls: string[] = [];
  const attachments: AttachmentMeta[] = [];
  const reply = (body: unknown, status = 200) => Promise.resolve(new Response(body === null ? null : JSON.stringify(body), { status }));
  const summary = (n: Note): NoteSummary => ({ id: n.id, title: n.title, snippet: n.contentHtml.replace(/<[^>]+>/g, ''), createdAt: n.createdAt, updatedAt: n.updatedAt, attachmentCount: 0 });

  const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'https://levelup.test');
    const method = init.method ?? 'GET';
    calls.push(`${method} ${url.pathname}${url.search}`);
    const path = url.pathname.replace('/api/', '');
    const upload = /^notes\/([^/]+)\/attachments$/.exec(path);
    if (upload && method === 'POST' && unlocked) {
      const file = init.body as File;
      const attachment = { id: crypto.randomUUID(), noteId: upload[1]!, filename: decodeURIComponent(new Headers(init.headers).get('x-filename') ?? ''), contentType: file.type, size: file.size, createdAt: new Date().toISOString() };
      attachments.push(attachment);
      return reply({ attachment }, 201);
    }
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, string>) : {};
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
  return { fetchMock, notes, calls, attachments };
}

const renderAt = (path: string) => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

describe('notes section', () => {
  let api: ReturnType<typeof fakeApi>;
  beforeEach(() => {
    api = fakeApi();
    vi.stubGlobal('fetch', api.fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('has its own compact sidebar menu and a top-bar button for new notes', async () => {
    renderAt('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('heading', { name: 'Library' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/notes');
    for (const link of screen.getAllByRole('link', { name: 'New note' })) expect(link).toHaveAttribute('href', '/notes?new=1');
    // The menu never lists note titles, so it doesn't call the API on every page.
    expect(api.fetchMock).not.toHaveBeenCalled();
  });

  it('opens a fresh note from a New note link, once', async () => {
    const user = userEvent.setup();
    renderAt('/notes?new=1');
    await user.type(await screen.findByLabelText('Passphrase'), 'open sesame{Enter}');
    expect(await screen.findByLabelText('Title')).toHaveFocus();
    expect(api.calls.filter((c) => c === 'POST /api/notes')).toHaveLength(1);
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

  it('attaches several files, or a whole folder, from the picker buttons', async () => {
    // jsdom has no folder picking; pretend the browser supports it so the button shows.
    Object.defineProperty(HTMLInputElement.prototype, 'webkitdirectory', { configurable: true, writable: true, value: false });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      const user = userEvent.setup();
      renderAt('/notes');
      await user.type(await screen.findByLabelText('Passphrase'), 'open sesame{Enter}');
      await user.click(await screen.findByRole('button', { name: 'New note' }));
      const section = within(await screen.findByRole('region', { name: /Attachments/ }));

      // Choose files: a multi-select picker.
      expect(section.getByRole('button', { name: 'Choose files' })).toBeInTheDocument();
      const filesInput = screen.getByLabelText<HTMLInputElement>('Attach files');
      expect(filesInput.multiple).toBe(true);
      await user.upload(filesInput, [new File(['a'], 'diagram.png', { type: 'image/png' }), new File(['b'], 'spec.pdf', { type: 'application/pdf' })]);
      expect(await section.findByRole('link', { name: 'diagram.png' })).toBeInTheDocument();
      expect(await section.findByRole('link', { name: 'spec.pdf' })).toBeInTheDocument();

      // Choose folder: skips OS clutter and oversized files, and says what it skipped.
      expect(section.getByRole('button', { name: 'Choose folder' })).toBeInTheDocument();
      const inFolder = (file: File) => Object.defineProperty(file, 'webkitRelativePath', { value: `design/${file.name}` });
      const big = inFolder(new File(['x'], 'video.mov'));
      Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 });
      const folderInput = screen.getByLabelText<HTMLInputElement>('Attach a folder');
      await user.upload(folderInput, [inFolder(new File(['c'], 'notes.txt', { type: 'text/plain' })), inFolder(new File(['d'], '.DS_Store')), big]);
      expect(await section.findByRole('link', { name: 'notes.txt' })).toBeInTheDocument();
      expect(await section.findByRole('alert')).toHaveTextContent('Skipped video.mov: files can be up to 4 MB.');
      expect(api.attachments.map((a) => a.filename)).toEqual(['diagram.png', 'spec.pdf', 'notes.txt']);
      expect(confirm).not.toHaveBeenCalled(); // only asks above 20 files
    } finally {
      confirm.mockRestore();
      delete (HTMLInputElement.prototype as { webkitdirectory?: boolean }).webkitdirectory;
    }
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

  it('renders Mermaid diagrams and edits draw.io diagrams in the embedded editor', async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const oldSvg = 'data:image/svg+xml;base64,PHN2Zz5vbGQ8L3N2Zz4=';
    const newSvg = 'data:image/svg+xml;base64,PHN2Zz5uZXc8L3N2Zz4=';
    api.notes.set(NOTE_ID, {
      id: NOTE_ID,
      title: 'Architecture',
      contentHtml: `<pre><code class="language-mermaid">flowchart LR\n  A --&gt; B</code></pre><figure data-type="drawio"><img src="${oldSvg}" alt="draw.io diagram"></figure>`,
      createdAt: now,
      updatedAt: now,
      attachments: [],
    });
    renderAt(`/notes?note=${NOTE_ID}`);
    await user.type(await screen.findByLabelText('Passphrase'), 'open sesame{Enter}');

    // Mermaid: rendered as a diagram, source hidden until "Edit code".
    expect(await screen.findByRole('img', { name: 'Diagram: flowchart LR' })).toContainElement(await screen.findByTestId('mermaid-svg'));
    expect(screen.getByRole('button', { name: 'Edit code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mermaid diagram' })).toBeInTheDocument();

    // draw.io: the saved SVG shows; editing round-trips through the diagrams.net iframe.
    expect(screen.getByRole('img', { name: 'draw.io diagram' })).toHaveAttribute('src', oldSvg);
    await user.click(screen.getByRole('button', { name: 'Edit diagram' }));
    const dialog = await screen.findByRole('dialog', { name: 'draw.io editor' });
    const frame = within(dialog).getByTitle<HTMLIFrameElement>('draw.io editor');
    expect(frame.src).toMatch(/^https:\/\/embed\.diagrams\.net\/\?embed=1&proto=json/);
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
    const fromDrawio = (data: object, origin = 'https://embed.diagrams.net') =>
      window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), origin, source: frame.contentWindow }));

    fromDrawio({ event: 'init' });
    expect(JSON.parse(posted.mock.calls[0]![0] as string)).toMatchObject({ action: 'load', xml: oldSvg });
    fromDrawio({ event: 'save', xml: '<mxfile/>', exit: true });
    expect(JSON.parse(posted.mock.calls[1]![0] as string)).toMatchObject({ action: 'export', format: 'xmlsvg', xml: '<mxfile/>' });
    // Messages from any other origin are ignored.
    fromDrawio({ event: 'export', data: 'data:image/svg+xml;base64,ZXZpbA==' }, 'https://evil.example');
    expect(screen.getByRole('img', { name: 'draw.io diagram' })).toHaveAttribute('src', oldSvg);

    fromDrawio({ event: 'export', data: newSvg });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'draw.io editor' })).not.toBeInTheDocument());
    expect(screen.getByRole('img', { name: 'draw.io diagram' })).toHaveAttribute('src', newSvg);
    await waitFor(() => expect(api.notes.get(NOTE_ID)?.contentHtml).toContain(newSvg), { timeout: 3000 });
  });
});
