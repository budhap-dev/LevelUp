// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { createApp, LOGIN_MAX_FAILURES } from '../../api/_lib/app.ts';
import { createSessionToken, verifySessionToken } from '../../api/_lib/auth.ts';
import { htmlToText, sanitizeNoteHtml } from '../../api/_lib/html.ts';
import { toPrefixTsQuery, type NotesRepo } from '../../api/_lib/repo.ts';
import { CLIENT_HEADER, MAX_ATTACHMENT_BYTES, type AttachmentMeta, type Note } from '../../src/lib/notes/types.ts';
import { markdownToNoteHtml } from './cli.ts';

/** Just enough of NotesRepo to exercise the HTTP layer. Search is a plain substring match. */
function memoryRepo(): NotesRepo {
  const notes = new Map<string, Note & { contentText: string }>();
  const files = new Map<string, { meta: AttachmentMeta; data: Uint8Array }>();
  const failures: { key: string; at: number }[] = [];
  const now = () => new Date().toISOString();
  const strip = ({ contentText: _, ...n }: Note & { contentText: string }): Note => ({
    ...n,
    attachments: [...files.values()].filter((f) => f.meta.noteId === n.id).map((f) => f.meta),
  });
  const recent = (key: string, mins: number) => failures.filter((f) => f.key === key && f.at > Date.now() - mins * 60_000).length;
  return {
    async list(q) {
      return [...notes.values()]
        .filter((n) => !q || `${n.title} ${n.contentText}`.toLowerCase().includes(q.toLowerCase()))
        .map((n) => ({ id: n.id, title: n.title, snippet: n.contentText, createdAt: n.createdAt, updatedAt: n.updatedAt, attachmentCount: strip(n).attachments.length }));
    },
    async get(id) {
      const n = notes.get(id);
      return n ? strip(n) : null;
    },
    async create(input) {
      const id = randomUUID();
      notes.set(id, { id, title: input.title ?? '', contentHtml: input.contentHtml ?? '', contentText: input.contentText ?? '', createdAt: now(), updatedAt: now(), attachments: [] });
      return strip(notes.get(id)!);
    },
    async update(id, input) {
      const n = notes.get(id);
      if (!n) return null;
      Object.assign(n, Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)), { updatedAt: now() });
      return strip(n);
    },
    async remove(id) {
      for (const [fid, f] of files) if (f.meta.noteId === id) files.delete(fid);
      return notes.delete(id);
    },
    async addAttachment(noteId, file) {
      if (!notes.has(noteId)) return null;
      const meta = { id: randomUUID(), noteId, filename: file.filename, contentType: file.contentType, size: file.data.byteLength, createdAt: now() };
      files.set(meta.id, { meta, data: file.data });
      return meta;
    },
    async getAttachment(id) {
      return files.get(id) ?? null;
    },
    async removeAttachment(id) {
      return files.delete(id);
    },
    async recordLoginFailure(key, mins) {
      failures.push({ key, at: Date.now() });
      return recent(key, mins);
    },
    async loginFailures(key, mins) {
      return recent(key, mins);
    },
  };
}

const SECRET = 'test-secret';
const PASSWORD = 'correct horse battery staple';

function setup() {
  const repo = memoryRepo();
  const app = createApp({ repo: () => repo, password: PASSWORD, sessionSecret: SECRET });
  const cookie = `notes_session=${createSessionToken(SECRET)}`;
  const call = (path: string, init: RequestInit & { auth?: boolean } = {}) => {
    const { auth = true, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (auth) headers.set('cookie', cookie);
    if (!headers.has(CLIENT_HEADER)) headers.set(CLIENT_HEADER, '1');
    return app(new Request(`https://notes.test/api/${path}`, { ...rest, headers }));
  };
  const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { call, json, repo };
}

describe('sessions', () => {
  it('signs tokens that expire and reject tampering', () => {
    const t = createSessionToken(SECRET, 1_000);
    expect(verifySessionToken(t, SECRET, 2_000)).toBe(true);
    expect(verifySessionToken(t, 'other-secret', 2_000)).toBe(false);
    expect(verifySessionToken(t.replace(/^\d+/, '99999999999999'), SECRET, 2_000)).toBe(false);
    expect(verifySessionToken(t, SECRET, 1_000 + 31 * 86_400_000)).toBe(false);
  });

  it('unlocks with the passphrase and sets an HttpOnly cookie', async () => {
    const { call, json } = setup();
    expect((await call('session', { auth: false })).status).toBe(401);
    expect((await call('session', { auth: false, ...json('POST', { password: 'nope' }) })).status).toBe(401);
    const ok = await call('session', { auth: false, ...json('POST', { password: PASSWORD }) });
    expect(ok.status).toBe(204);
    const cookie = ok.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^notes_session=\d+\.[\w-]+; Path=\/api; HttpOnly; SameSite=Strict; Max-Age=\d+; Secure$/);
    const token = cookie.split(';')[0]!;
    expect((await call('session', { auth: false, headers: { cookie: token } })).status).toBe(200);
  });

  it('rate-limits repeated wrong passphrases', async () => {
    const { call, json } = setup();
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) await call('session', { auth: false, ...json('POST', { password: 'x' }) });
    const blocked = await call('session', { auth: false, ...json('POST', { password: PASSWORD }) });
    expect(blocked.status).toBe(429);
  });

  it('refuses every notes route without a session, and writes without the client header', async () => {
    const { call, json } = setup();
    expect((await call('notes', { auth: false })).status).toBe(401);
    expect((await call('notes', { ...json('POST', {}), headers: { [CLIENT_HEADER]: '0', 'content-type': 'application/json' } })).status).toBe(403);
  });

  it('reports a missing configuration instead of running unlocked', async () => {
    const app = createApp({ repo: memoryRepo, password: undefined, sessionSecret: SECRET });
    expect((await app(new Request('https://x/api/notes'))).status).toBe(503);
  });
});

describe('notes CRUD', () => {
  it('creates, edits, searches and deletes a note, sanitising its HTML', async () => {
    const { call, json } = setup();
    const created = await call('notes', json('POST', { title: '  Kafka   ideas ', contentHtml: '<p>Partitions <script>alert(1)</script><strong>matter</strong></p>' }));
    expect(created.status).toBe(201);
    const { note } = (await created.json()) as { note: Note };
    expect(note.title).toBe('Kafka ideas');
    expect(note.contentHtml).toBe('<p>Partitions <strong>matter</strong></p>');

    const patched = (await (await call(`notes/${note.id}`, json('PATCH', { contentHtml: '<p>Consumer groups</p>' }))).json()) as { note: Note };
    expect(patched.note.contentHtml).toBe('<p>Consumer groups</p>');
    expect(patched.note.title).toBe('Kafka ideas');

    const found = (await (await call('notes?q=consumer')).json()) as { notes: { id: string }[] };
    expect(found.notes.map((n) => n.id)).toEqual([note.id]);
    expect(((await (await call('notes?q=zookeeper')).json()) as { notes: unknown[] }).notes).toEqual([]);

    expect((await call(`notes/${note.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await call(`notes/${note.id}`)).status).toBe(404);
  });

  it('rejects malformed ids and bodies', async () => {
    const { call, json } = setup();
    expect((await call('notes/not-a-uuid')).status).toBe(404);
    expect((await call('notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '[1]' })).status).toBe(400);
    expect((await call('notes', json('POST', { title: 42 }))).status).toBe(400);
  });

  it('reads the route from the ?path= query that the Vercel rewrite adds', async () => {
    const { call, json } = setup();
    await call('notes', json('POST', { title: 'Via rewrite' }));
    const res = await call('router?path=notes');
    expect(((await res.json()) as { notes: { title: string }[] }).notes[0]!.title).toBe('Via rewrite');
  });
});

describe('attachments', () => {
  it('uploads, serves and deletes a file', async () => {
    const { call, json } = setup();
    const { note } = (await (await call('notes', json('POST', { title: 'With files' }))).json()) as { note: Note };
    const bytes = new TextEncoder().encode('hello world');
    const up = await call(`notes/${note.id}/attachments`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', 'x-filename': encodeURIComponent('résumé "v2".txt') },
      body: bytes,
    });
    expect(up.status).toBe(201);
    const { attachment } = (await up.json()) as { attachment: AttachmentMeta };
    expect(attachment).toMatchObject({ filename: 'résumé "v2".txt', size: 11, contentType: 'text/plain' });

    const file = await call(`attachments/${attachment.id}`);
    expect(await file.text()).toBe('hello world');
    expect(file.headers.get('content-disposition')).toBe(`inline; filename="r_sum_ _v2_.txt"; filename*=UTF-8''${encodeURIComponent('résumé "v2".txt')}`);
    expect(file.headers.get('content-security-policy')).toContain('sandbox');
    expect((await call(`attachments/${attachment.id}?download=1`)).headers.get('content-disposition')).toMatch(/^attachment;/);

    expect((await call(`attachments/${attachment.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await call(`attachments/${attachment.id}`)).status).toBe(404);
  });

  it('always downloads active content such as HTML and SVG', async () => {
    const { call, json } = setup();
    const { note } = (await (await call('notes', json('POST', {}))).json()) as { note: Note };
    const up = await call(`notes/${note.id}/attachments`, { method: 'POST', headers: { 'content-type': 'image/svg+xml', 'x-filename': 'x.svg' }, body: '<svg/>' });
    const { attachment } = (await up.json()) as { attachment: AttachmentMeta };
    expect((await call(`attachments/${attachment.id}`)).headers.get('content-disposition')).toMatch(/^attachment;/);
  });

  it('rejects files over the limit and uploads to missing notes', async () => {
    const { call } = setup();
    const big = await call(`notes/${randomUUID()}/attachments`, { method: 'POST', body: new Uint8Array(MAX_ATTACHMENT_BYTES + 1) });
    expect(big.status).toBe(413);
    const missing = await call(`notes/${randomUUID()}/attachments`, { method: 'POST', body: new Uint8Array(3) });
    expect(missing.status).toBe(404);
  });
});

describe('note HTML', () => {
  it('keeps editor markup, drops anything dangerous', () => {
    const html = sanitizeNoteHtml(
      '<h2 onclick="x()">Title</h2><p><a href="javascript:alert(1)">bad</a> <a href="https://ok.dev">ok</a></p>' +
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked></label><div><p>Done</p></div></li></ul>' +
        '<pre><code class="language-ts evil">x</code></pre><img src=x onerror=alert(1)><input type="text">',
    );
    expect(html).toBe(
      '<h2>Title</h2><p><a target="_blank" rel="noopener noreferrer nofollow">bad</a> <a href="https://ok.dev" target="_blank" rel="noopener noreferrer nofollow">ok</a></p>' +
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /></label><div><p>Done</p></div></li></ul>' +
        '<pre><code class="language-ts">x</code></pre>',
    );
  });

  it('keeps diagrams: Mermaid code blocks and draw.io figures with an embedded image only', () => {
    const svg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    expect(sanitizeNoteHtml('<pre><code class="language-mermaid">flowchart LR\n  A --&gt; B</code></pre>')).toBe(
      '<pre><code class="language-mermaid">flowchart LR\n  A --&gt; B</code></pre>',
    );
    expect(sanitizeNoteHtml(`<figure data-type="drawio" onclick="x()"><img src="${svg}" alt="draw.io diagram" onerror="x()"></figure>`)).toBe(
      `<figure data-type="drawio"><img src="${svg}" alt="draw.io diagram" /></figure>`,
    );
    // Linked, non-image, or script-bearing data URIs are dropped, as are other figures.
    expect(sanitizeNoteHtml('<img src="https://tracker.example/p.gif">')).toBe('');
    expect(sanitizeNoteHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">')).toBe('');
    expect(sanitizeNoteHtml('<img src="data:image/svg+xml,<svg onload=alert(1)>">')).toBe('');
    expect(sanitizeNoteHtml('<figure><p>x</p></figure>')).toBe('');
  });

  it('extracts searchable text with block breaks and decoded entities', () => {
    expect(htmlToText('<h1>A &amp; B</h1><p>one<br>two</p><ul><li><p>x &lt; y</p></li></ul>')).toBe('A & B\none\ntwo\nx < y');
  });

  it('builds prefix search queries from free text', () => {
    expect(toPrefixTsQuery('Redis  cach!')).toBe('redis:* & cach:*');
    expect(toPrefixTsQuery("  ' & | ")).toBe('');
  });

  it('converts Markdown (with checklists) into editor HTML', async () => {
    const html = await markdownToNoteHtml('# Plan\n\n- [x] shipped\n- [ ] todo\n\nSee **[docs](https://neon.tech)**');
    expect(html).toContain('<h1>Plan</h1>');
    expect(html).toContain('<ul data-type="taskList">');
    expect(html).toMatch(/<li data-type="taskItem" data-checked="true">\s*shipped<\/li>/);
    expect(html).toMatch(/<li data-type="taskItem" data-checked="false">\s*todo<\/li>/);
    expect(html).toContain('<a href="https://neon.tech" target="_blank" rel="noopener noreferrer nofollow">docs</a>');
  });

  it('keeps ```mermaid fences as Mermaid code blocks, which the editor renders as diagrams', async () => {
    const html = await markdownToNoteHtml('```mermaid\nflowchart LR\n  A --> B\n```');
    expect(html).toBe('<pre><code class="language-mermaid">flowchart LR\n  A --&gt; B\n</code></pre>');
  });
});
