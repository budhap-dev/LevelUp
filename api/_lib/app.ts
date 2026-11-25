import { CLIENT_HEADER, MAX_ATTACHMENT_BYTES, type NoteInput } from '../../src/lib/notes/types.js';
import {
  SESSION_COOKIE,
  clearedSessionCookies,
  createSessionToken,
  passwordMatches,
  readCookie,
  sessionCookie,
  verifySessionToken,
} from './auth.js';
import { htmlToText, sanitizeNoteHtml } from './html.js';
import type { NotesRepo } from './repo.js';

export interface AppConfig {
  /** Called lazily so a missing DATABASE_URL only fails requests that need the database. */
  repo: () => NotesRepo;
  password: string | undefined;
  sessionSecret: string | undefined;
}

export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_MAX_FAILURES = 10;
/** Notes can embed draw.io diagrams, so allow up to just under Vercel's 4.5 MB request limit. */
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_TITLE = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
const empty = (status = 204, headers: Record<string, string> = {}) => new Response(null, { status, headers: { 'cache-control': 'no-store', ...headers } });
const fail = (status: number, error: string) => json({ error }, status);

/** Path segments after /api. Vercel rewrites /api/* to /api/router?path=*; local dev passes the real path. */
function routeOf(url: URL): string[] {
  const rewritten = url.searchParams.get('path');
  const raw = rewritten ?? url.pathname.replace(/^\/api\/?/, '');
  return raw.split('/').filter(Boolean).map(decodeURIComponent);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_JSON_BYTES) throw new HttpError(413, 'Note is too large');
  const text = await request.text();
  if (text.length > MAX_JSON_BYTES) throw new HttpError(413, 'Note is too large');
  try {
    const body: unknown = JSON.parse(text || '{}');
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new HttpError(400, 'Expected a JSON object');
}

function noteWrite(body: Record<string, unknown>) {
  const input: NoteInput = {};
  if (body.title !== undefined) {
    if (typeof body.title !== 'string') throw new HttpError(400, 'title must be a string');
    input.title = body.title.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);
  }
  if (body.contentHtml !== undefined) {
    if (typeof body.contentHtml !== 'string') throw new HttpError(400, 'contentHtml must be a string');
    input.contentHtml = sanitizeNoteHtml(body.contentHtml);
  }
  return { ...input, contentText: input.contentHtml === undefined ? undefined : htmlToText(input.contentHtml) };
}

const clientKey = (request: Request) =>
  request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

/** Images and PDFs open in the browser; anything else (HTML, SVG…) is always downloaded. */
const INLINE_TYPES = /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf|text\/plain)$/;

function contentDisposition(filename: string, inline: boolean) {
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function cleanFilename(raw: string | null): string {
  let name = 'file';
  try {
    name = decodeURIComponent(raw ?? '') || name;
  } catch {
    /* keep default */
  }
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim().slice(0, 200) || 'file';
}

export function createApp(config: AppConfig) {
  async function route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const secure = url.protocol === 'https:';
    const [resource, id, sub, ...rest] = routeOf(url);
    const method = request.method.toUpperCase();

    if (!config.password || !config.sessionSecret) return fail(503, 'Notes are not configured on this server');
    const secret = config.sessionSecret;

    // Custom header: a cross-site page can't set it without a CORS preflight, which this API never grants.
    if (method !== 'GET' && method !== 'HEAD' && request.headers.get(CLIENT_HEADER) !== '1') return fail(403, 'Missing client header');

    // ----- Session -----
    if (resource === 'session' && !id) {
      if (method === 'GET') {
        return verifySessionToken(readCookie(request, SESSION_COOKIE), secret) ? json({ authenticated: true }) : fail(401, 'Locked');
      }
      if (method === 'POST') {
        const repo = config.repo();
        const key = clientKey(request);
        if ((await repo.loginFailures(key, LOGIN_WINDOW_MINUTES)) >= LOGIN_MAX_FAILURES) {
          return fail(429, `Too many attempts. Try again in ${LOGIN_WINDOW_MINUTES} minutes.`);
        }
        const body = await readJson(request);
        if (typeof body.password !== 'string' || !passwordMatches(body.password, config.password)) {
          await repo.recordLoginFailure(key, LOGIN_WINDOW_MINUTES);
          return fail(401, 'Wrong passphrase');
        }
        return empty(204, { 'set-cookie': sessionCookie(createSessionToken(secret), secure) });
      }
      if (method === 'DELETE') {
        const headers = new Headers({ 'cache-control': 'no-store' });
        for (const cookie of clearedSessionCookies(secure)) headers.append('set-cookie', cookie);
        return new Response(null, { status: 204, headers });
      }
      return fail(405, 'Method not allowed');
    }

    // Everything below needs a session.
    if (resource !== 'notes' && resource !== 'attachments') return fail(404, 'Not found');
    if (!verifySessionToken(readCookie(request, SESSION_COOKIE), secret)) return fail(401, 'Locked');
    if (id !== undefined && !UUID.test(id)) return fail(404, 'Not found');
    if (rest.length) return fail(404, 'Not found');
    const repo = config.repo();

    // ----- Notes -----
    if (resource === 'notes' && !id) {
      if (method === 'GET') return json({ notes: await repo.list((url.searchParams.get('q') ?? '').slice(0, 200)) });
      if (method === 'POST') return json({ note: await repo.create(noteWrite(await readJson(request))) }, 201);
      return fail(405, 'Method not allowed');
    }

    if (resource === 'notes' && id && !sub) {
      if (method === 'GET') {
        const note = await repo.get(id);
        return note ? json({ note }) : fail(404, 'Note not found');
      }
      if (method === 'PATCH') {
        const note = await repo.update(id, noteWrite(await readJson(request)));
        return note ? json({ note }) : fail(404, 'Note not found');
      }
      if (method === 'DELETE') return (await repo.remove(id)) ? empty() : fail(404, 'Note not found');
      return fail(405, 'Method not allowed');
    }

    if (resource === 'notes' && id && sub === 'attachments') {
      if (method !== 'POST') return fail(405, 'Method not allowed');
      const declared = Number(request.headers.get('content-length') ?? 0);
      if (declared > MAX_ATTACHMENT_BYTES) return fail(413, 'Files can be up to 4 MB');
      const data = new Uint8Array(await request.arrayBuffer());
      if (data.byteLength > MAX_ATTACHMENT_BYTES) return fail(413, 'Files can be up to 4 MB');
      if (data.byteLength === 0) return fail(400, 'File is empty');
      const contentType = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase() || 'application/octet-stream';
      const attachment = await repo.addAttachment(id, {
        filename: cleanFilename(request.headers.get('x-filename')),
        contentType: /^[\w.+-]+\/[\w.+-]+$/.test(contentType) ? contentType : 'application/octet-stream',
        data,
      });
      return attachment ? json({ attachment }, 201) : fail(404, 'Note not found');
    }

    // ----- Attachments -----
    if (resource === 'attachments' && id && !sub) {
      if (method === 'GET' || method === 'HEAD') {
        const file = await repo.getAttachment(id);
        if (!file) return fail(404, 'Attachment not found');
        const inline = url.searchParams.get('download') !== '1' && INLINE_TYPES.test(file.meta.contentType);
        return new Response(method === 'HEAD' ? null : (file.data as Uint8Array<ArrayBuffer>), {
          headers: {
            'content-type': file.meta.contentType,
            'content-length': String(file.data.byteLength),
            'content-disposition': contentDisposition(file.meta.filename, inline),
            'cache-control': 'private, max-age=3600',
            'x-content-type-options': 'nosniff',
            // Even if a browser renders the file, it can't run script or reach the app's origin.
            'content-security-policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
          },
        });
      }
      if (method === 'DELETE') return (await repo.removeAttachment(id)) ? empty() : fail(404, 'Attachment not found');
      return fail(405, 'Method not allowed');
    }

    return fail(404, 'Not found');
  }

  return async function handle(request: Request): Promise<Response> {
    try {
      return await route(request);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message);
      console.error('[notes api]', err);
      return fail(500, 'Something went wrong');
    }
  };
}
