/**
 * Validation, migration and merging for progress data.
 * Hand-written (not Zod) to keep the app bundle small; tolerant of bad entries,
 * strict about the overall shape.
 */
import {
  PROGRESS_SCHEMA_VERSION,
  TOPIC_STATES,
  emptyProgress,
  type Bookmark,
  type Note,
  type ProgressData,
  type ReviewCard,
  type TopicProgress,
  type TopicState,
} from './types';

export class ProgressFormatError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isDate = (v: unknown): v is string => isStr(v) && !Number.isNaN(Date.parse(v));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optional = <T>(v: unknown, check: (v: unknown) => v is T): T | undefined => (check(v) ? v : undefined);

function topic(v: unknown): TopicProgress | null {
  if (!isObj(v) || !TOPIC_STATES.includes(v.state as TopicState) || !isDate(v.updatedAt)) return null;
  return {
    state: v.state as TopicState,
    updatedAt: v.updatedAt,
    ...(isDate(v.lastVisitedAt) && { lastVisitedAt: v.lastVisitedAt }),
    ...(isStr(v.lastSectionId) && { lastSectionId: v.lastSectionId }),
  };
}

function bookmark(id: string, v: unknown): Bookmark | null {
  if (!isObj(v) || !isStr(v.topicId) || !isStr(v.label) || !isDate(v.createdAt)) return null;
  const anchor = optional(v.anchor, isStr);
  if (id !== (anchor ? `${v.topicId}#${anchor}` : v.topicId)) return null;
  return { id, topicId: v.topicId, ...(anchor && { anchor }), label: v.label, createdAt: v.createdAt };
}

function note(v: unknown): Note | null {
  if (!isObj(v) || !isStr(v.body) || !isDate(v.updatedAt)) return null;
  return { body: v.body, updatedAt: v.updatedAt };
}

function review(id: string, v: unknown): ReviewCard | null {
  if (
    !isObj(v) ||
    v.cardId !== id ||
    (v.kind !== 'question' && v.kind !== 'flashcard') ||
    !isNum(v.easiness) ||
    !isNum(v.intervalDays) ||
    !Number.isInteger(v.repetitions) ||
    !Number.isInteger(v.lapses) ||
    !isDate(v.dueAt)
  ) {
    return null;
  }
  return {
    cardId: id,
    kind: v.kind,
    easiness: v.easiness,
    intervalDays: v.intervalDays,
    repetitions: v.repetitions as number,
    lapses: v.lapses as number,
    dueAt: v.dueAt,
    ...(isDate(v.lastReviewedAt) && { lastReviewedAt: v.lastReviewedAt }),
  };
}

function collect<T>(raw: unknown, parse: (id: string, v: unknown) => T | null, counter: { dropped: number }): Record<string, T> {
  const out: Record<string, T> = {};
  if (raw === undefined) return out;
  if (!isObj(raw)) {
    counter.dropped += 1;
    return out;
  }
  for (const [id, value] of Object.entries(raw)) {
    const parsed = parse(id, value);
    if (parsed) out[id] = parsed;
    else counter.dropped += 1;
  }
  return out;
}

/**
 * Turn unknown input (localStorage contents, an imported file) into valid ProgressData.
 * Accepts the export wrapper `{ app, exportedAt, data }` or the raw data object.
 * Throws ProgressFormatError if the shape is unrecognisable or from a newer app version;
 * drops (and counts) individual invalid entries.
 */
export function normaliseProgress(input: unknown): { data: ProgressData; dropped: number } {
  const raw = isObj(input) && isObj(input.data) && input.app === EXPORT_APP ? input.data : input;
  if (!isObj(raw)) throw new ProgressFormatError('Not a LevelUp progress file.');

  const version = raw.schemaVersion ?? PROGRESS_SCHEMA_VERSION;
  if (!Number.isInteger(version) || (version as number) < 1) throw new ProgressFormatError('Not a LevelUp progress file.');
  if ((version as number) > PROGRESS_SCHEMA_VERSION) {
    throw new ProgressFormatError('This file was made by a newer version of LevelUp. Update the app, then import it again.');
  }
  if (!('topics' in raw) && !('bookmarks' in raw) && !('notes' in raw) && !('reviews' in raw)) {
    throw new ProgressFormatError('Not a LevelUp progress file.');
  }
  // Future: migrate older schema versions here, step by step.

  const counter = { dropped: 0 };
  return {
    data: {
      ...emptyProgress(),
      topics: collect(raw.topics, (_, v) => topic(v), counter),
      bookmarks: collect(raw.bookmarks, bookmark, counter),
      notes: collect(raw.notes, (_, v) => note(v), counter),
      reviews: collect(raw.reviews, review, counter),
    },
    dropped: counter.dropped,
  };
}

export const EXPORT_APP = 'levelup-engineer';

export function toExportJson(data: ProgressData, now = new Date()): string {
  return JSON.stringify({ app: EXPORT_APP, exportedAt: now.toISOString(), data }, null, 2);
}

const newer = <T>(a: T | undefined, b: T | undefined, at: (x: T) => string | undefined): T | undefined => {
  if (!a) return b;
  if (!b) return a;
  return (at(b) ?? '') > (at(a) ?? '') ? b : a;
};

function mergeRecords<T>(a: Record<string, T>, b: Record<string, T>, at: (x: T) => string | undefined): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [id, value] of Object.entries(b)) out[id] = newer(a[id], value, at)!;
  return out;
}

/** Merge two progress sets: for each entry keep whichever was changed most recently. */
export function mergeProgress(current: ProgressData, incoming: ProgressData): ProgressData {
  const topics = mergeRecords(current.topics, incoming.topics, (t) => t.updatedAt);
  // Visits are independent of state changes: keep the latest visit from either side.
  for (const id of Object.keys(topics)) {
    const visit = newer(current.topics[id], incoming.topics[id], (t) => t.lastVisitedAt);
    if (!visit?.lastVisitedAt) continue;
    const { lastSectionId: _drop, ...rest } = topics[id]!;
    topics[id] = { ...rest, lastVisitedAt: visit.lastVisitedAt, ...(visit.lastSectionId && { lastSectionId: visit.lastSectionId }) };
  }
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    topics,
    bookmarks: mergeRecords(current.bookmarks, incoming.bookmarks, (b) => b.createdAt),
    notes: mergeRecords(current.notes, incoming.notes, (n) => n.updatedAt),
    reviews: mergeRecords(current.reviews, incoming.reviews, (r) => r.lastReviewedAt),
  };
}
