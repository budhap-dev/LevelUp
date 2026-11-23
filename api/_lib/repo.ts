import { neon } from '@neondatabase/serverless';
import type { AttachmentMeta, Note, NoteSummary } from '../../src/lib/notes/types.js';
import { SNIPPET_MARK_END, SNIPPET_MARK_START } from '../../src/lib/notes/types.js';

export interface NoteWrite {
  title?: string;
  contentHtml?: string;
  contentText?: string;
}

export interface NewAttachment {
  filename: string;
  contentType: string;
  data: Uint8Array;
}

/** Storage for notes. The API talks to this interface; tests swap in an in-memory version. */
export interface NotesRepo {
  list(query: string): Promise<NoteSummary[]>;
  get(id: string): Promise<Note | null>;
  create(input: NoteWrite): Promise<Note>;
  update(id: string, input: NoteWrite): Promise<Note | null>;
  remove(id: string): Promise<boolean>;
  addAttachment(noteId: string, file: NewAttachment): Promise<AttachmentMeta | null>;
  getAttachment(id: string): Promise<{ meta: AttachmentMeta; data: Uint8Array } | null>;
  removeAttachment(id: string): Promise<boolean>;
  /** Records a failed passphrase attempt and returns how many `key` made in the last `windowMinutes`. */
  recordLoginFailure(key: string, windowMinutes: number): Promise<number>;
  loginFailures(key: string, windowMinutes: number): Promise<number>;
}

/** Idempotent schema, applied by `npm run notes -- migrate`. */
export const SCHEMA = [
  `create table if not exists notes (
    id uuid primary key default gen_random_uuid(),
    title text not null default '',
    content_html text not null default '',
    content_text text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    search tsvector generated always as (
      setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', content_text), 'B')
    ) stored
  )`,
  `create index if not exists notes_search_idx on notes using gin (search)`,
  `create index if not exists notes_updated_idx on notes (updated_at desc)`,
  `create table if not exists note_attachments (
    id uuid primary key default gen_random_uuid(),
    note_id uuid not null references notes (id) on delete cascade,
    filename text not null,
    content_type text not null,
    size integer not null,
    data bytea not null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists note_attachments_note_idx on note_attachments (note_id, created_at)`,
  `create table if not exists notes_login_failures (
    key text not null,
    at timestamptz not null default now()
  )`,
  `create index if not exists notes_login_failures_idx on notes_login_failures (key, at)`,
];

/**
 * Turns free text into a prefix tsquery, so results appear while typing:
 * "redis cach" → "redis:* & cach:*". Returns '' when there is nothing searchable.
 */
export function toPrefixTsQuery(q: string): string {
  const words = q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.slice(0, 12).map((w) => `${w}:*`).join(' & ');
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

const toAttachment = (r: Row): AttachmentMeta => ({
  id: String(r.id),
  noteId: String(r.note_id),
  filename: String(r.filename),
  contentType: String(r.content_type),
  size: Number(r.size),
  createdAt: iso(r.created_at),
});

export function createNeonRepo(databaseUrl: string): NotesRepo {
  const sql = neon(databaseUrl);
  const q = (text: string, params: unknown[] = []) => sql.query(text, params) as Promise<Row[]>;

  const get = async (id: string): Promise<Note | null> => {
    const [notes, files] = await sql.transaction([
      sql.query(`select id, title, content_html, created_at, updated_at from notes where id = $1`, [id]),
      sql.query(
        `select id, note_id, filename, content_type, size, created_at from note_attachments where note_id = $1 order by created_at`,
        [id],
      ),
    ]) as [Row[], Row[]];
    const n = notes[0];
    if (!n) return null;
    return {
      id: String(n.id),
      title: String(n.title),
      contentHtml: String(n.content_html),
      createdAt: iso(n.created_at),
      updatedAt: iso(n.updated_at),
      attachments: files.map(toAttachment),
    };
  };

  return {
    async list(query) {
      const tsq = toPrefixTsQuery(query);
      const trimmed = query.trim();
      const rows = trimmed
        ? await q(
            `with matched as (
               select n.*, ts_rank(n.search, to_tsquery('english', $1)) as rank
               from notes n
               where ($1 <> '' and n.search @@ to_tsquery('english', $1))
                  or n.title ilike $2 or n.content_text ilike $2
             )
             select id, title, created_at, updated_at, rank,
               (select count(*) from note_attachments a where a.note_id = matched.id)::int as attachment_count,
               case when $1 <> '' and search @@ to_tsquery('english', $1)
                 then ts_headline('english', content_text, to_tsquery('english', $1),
                        'StartSel=${SNIPPET_MARK_START}, StopSel=${SNIPPET_MARK_END}, MaxWords=28, MinWords=10, MaxFragments=2, FragmentDelimiter=" … "')
                 else left(content_text, 240) end as snippet
             from matched
             order by rank desc, updated_at desc
             limit 200`,
            [tsq, `%${escapeLike(trimmed)}%`],
          )
        : await q(
            `select id, title, created_at, updated_at, left(content_text, 240) as snippet,
               (select count(*) from note_attachments a where a.note_id = n.id)::int as attachment_count
             from notes n order by updated_at desc limit 200`,
          );
      return rows.map((r) => ({
        id: String(r.id),
        title: String(r.title),
        snippet: String(r.snippet ?? ''),
        createdAt: iso(r.created_at),
        updatedAt: iso(r.updated_at),
        attachmentCount: Number(r.attachment_count),
      }));
    },

    get,

    async create(input) {
      const [row] = await q(`insert into notes (title, content_html, content_text) values ($1, $2, $3) returning id`, [
        input.title ?? '',
        input.contentHtml ?? '',
        input.contentText ?? '',
      ]);
      return (await get(String(row!.id)))!;
    },

    async update(id, input) {
      const rows = await q(
        `update notes set
           title = coalesce($2, title),
           content_html = coalesce($3, content_html),
           content_text = coalesce($4, content_text),
           updated_at = now()
         where id = $1 returning id`,
        [id, input.title ?? null, input.contentHtml ?? null, input.contentText ?? null],
      );
      return rows.length ? get(id) : null;
    },

    async remove(id) {
      return (await q(`delete from notes where id = $1 returning id`, [id])).length > 0;
    },

    async addAttachment(noteId, file) {
      // Base64 keeps the bytes intact over Neon's JSON-over-HTTP protocol.
      const rows = await q(
        `with ins as (
           insert into note_attachments (note_id, filename, content_type, size, data)
           select id, $2, $3, $4, decode($5, 'base64') from notes where id = $1
           returning id, note_id, filename, content_type, size, created_at
         ), touch as (
           update notes set updated_at = now() where id = $1 and exists (select 1 from ins)
         )
         select * from ins`,
        [noteId, file.filename, file.contentType, file.data.byteLength, Buffer.from(file.data).toString('base64')],
      );
      return rows[0] ? toAttachment(rows[0]) : null;
    },

    async getAttachment(id) {
      const [r] = await q(
        `select id, note_id, filename, content_type, size, created_at, encode(data, 'base64') as b64 from note_attachments where id = $1`,
        [id],
      );
      return r ? { meta: toAttachment(r), data: new Uint8Array(Buffer.from(String(r.b64), 'base64')) } : null;
    },

    async removeAttachment(id) {
      return (await q(`delete from note_attachments where id = $1 returning id`, [id])).length > 0;
    },

    async recordLoginFailure(key, windowMinutes) {
      const [, [r]] = await sql.transaction([
        sql.query(`insert into notes_login_failures (key) values ($1)`, [key]),
        sql.query(
          `select count(*)::int as n from notes_login_failures where key = $1 and at > now() - make_interval(mins => $2)`,
          [key, windowMinutes],
        ),
      ]) as [Row[], Row[]];
      // Housekeeping: old rows are useless.
      await q(`delete from notes_login_failures where at < now() - interval '1 day'`);
      return Number(r?.n ?? 0);
    },

    async loginFailures(key, windowMinutes) {
      const [r] = await q(
        `select count(*)::int as n from notes_login_failures where key = $1 and at > now() - make_interval(mins => $2)`,
        [key, windowMinutes],
      );
      return Number(r?.n ?? 0);
    },
  };
}
