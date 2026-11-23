/**
 * Notes API shapes, shared by the browser client (src/lib/notes/client.ts) and the
 * serverless API (api/_lib). Type-only: nothing here is bundled into either side.
 */

export interface AttachmentMeta {
  id: string;
  noteId: string;
  filename: string;
  contentType: string;
  /** Bytes. */
  size: number;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  /** Sanitised HTML produced by the rich-text editor. */
  contentHtml: string;
  createdAt: string;
  updatedAt: string;
  attachments: AttachmentMeta[];
}

export interface NoteSummary {
  id: string;
  title: string;
  /**
   * Plain-text excerpt. When the list was searched, matched terms are wrapped in
   * {@link SNIPPET_MARK_START} / {@link SNIPPET_MARK_END}.
   */
  snippet: string;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
}

export interface NoteInput {
  title?: string;
  contentHtml?: string;
}

export const SNIPPET_MARK_START = '⟦'; // ⟦
export const SNIPPET_MARK_END = '⟧'; // ⟧

/** Largest attachment the API accepts. Vercel caps function request and response bodies at 4.5 MB. */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/** Header that every state-changing request must carry (blocks cross-site form posts). */
export const CLIENT_HEADER = 'x-notes-client';
