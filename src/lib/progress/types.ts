/**
 * Learner progress. Everything here belongs to the user and lives in their browser
 * (or, later, whatever ProgressStore backend replaces localStorage).
 */

export const PROGRESS_SCHEMA_VERSION = 1;

export const TOPIC_STATES = ['not-started', 'in-progress', 'learned', 'needs-revision'] as const;
export type TopicState = (typeof TOPIC_STATES)[number];

export interface TopicProgress {
  state: TopicState;
  /** When the state last changed. */
  updatedAt: string;
  lastVisitedAt?: string;
  /** Section the user was reading most recently (for "continue where you left off"). */
  lastSectionId?: string;
}

export interface Bookmark {
  /** `${topicId}` for a topic, `${topicId}#${anchor}` for a section or question. */
  id: string;
  topicId: string;
  anchor?: string;
  /** Text shown in the bookmarks list (captured when bookmarked, so the list needs no topic data). */
  label: string;
  createdAt: string;
}

export interface Note {
  body: string;
  updatedAt: string;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';

/** Spaced-repetition state for one card (used from phase 4). */
export interface ReviewCard {
  cardId: string;
  kind: 'question' | 'flashcard';
  easiness: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: string;
  lastReviewedAt?: string;
}

export interface ProgressData {
  schemaVersion: typeof PROGRESS_SCHEMA_VERSION;
  topics: Record<string, TopicProgress>;
  bookmarks: Record<string, Bookmark>;
  notes: Record<string, Note>;
  reviews: Record<string, ReviewCard>;
}

/**
 * Persistence backend. Async so a remote API can implement it; localStorage implements it today.
 * Format concerns (validation, export/import, merging) live above this interface, not in backends.
 */
export interface ProgressStore {
  /** Synchronous read for first paint, when the backend can (localStorage can; an API can't). */
  peek?(): unknown;
  load(): Promise<unknown>;
  save(data: ProgressData): Promise<void>;
  /** Be told when data changes elsewhere (another tab or device). Returns an unsubscribe function. */
  watch?(onChange: () => void): () => void;
}

export const emptyProgress = (): ProgressData => ({
  schemaVersion: PROGRESS_SCHEMA_VERSION,
  topics: {},
  bookmarks: {},
  notes: {},
  reviews: {},
});
