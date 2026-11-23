import { CLIENT_HEADER, MAX_ATTACHMENT_BYTES, type AttachmentMeta, type Note, type NoteInput, type NoteSummary } from './types';

export class NotesApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: { [CLIENT_HEADER]: '1', ...init.headers },
    });
  } catch {
    throw new NotesApiError(0, navigator.onLine === false ? 'You’re offline. Notes need a connection.' : 'Couldn’t reach the server.');
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new NotesApiError(res.status, body.error ?? `Request failed (${res.status})`);
  return body;
}

const sendJson = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const notesApi = {
  /** Resolves true when this browser has a valid session, false when the passphrase is needed. */
  async session(): Promise<boolean> {
    try {
      await request('session');
      return true;
    } catch (e) {
      if (e instanceof NotesApiError && e.status === 401) return false;
      throw e;
    }
  },
  unlock: (password: string) => request<void>('session', sendJson('POST', { password })),
  lock: () => request<void>('session', { method: 'DELETE' }),

  list: (q = '', signal?: AbortSignal) =>
    request<{ notes: NoteSummary[] }>(`notes${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`, { signal }).then((r) => r.notes),
  get: (id: string) => request<{ note: Note }>(`notes/${id}`).then((r) => r.note),
  create: (input: NoteInput = {}) => request<{ note: Note }>('notes', sendJson('POST', input)).then((r) => r.note),
  update: (id: string, input: NoteInput) => request<{ note: Note }>(`notes/${id}`, sendJson('PATCH', input)).then((r) => r.note),
  remove: (id: string) => request<void>(`notes/${id}`, { method: 'DELETE' }),

  async attach(noteId: string, file: File): Promise<AttachmentMeta> {
    if (file.size > MAX_ATTACHMENT_BYTES) throw new NotesApiError(413, `${file.name} is larger than 4 MB`);
    const r = await request<{ attachment: AttachmentMeta }>(`notes/${noteId}/attachments`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream', 'x-filename': encodeURIComponent(file.name) },
      body: file,
    });
    return r.attachment;
  },
  removeAttachment: (id: string) => request<void>(`attachments/${id}`, { method: 'DELETE' }),
  attachmentUrl: (id: string, download = false) => `/api/attachments/${id}${download ? '?download=1' : ''}`,
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
