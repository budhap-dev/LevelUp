/**
 * Content model shared by the build-time pipeline (scripts/content) and the app.
 * Keep this file free of browser/Node-specific imports.
 */
import { z } from 'zod';

export const LEVELS = ['Foundation', 'Senior', 'Architect'] as const;
export const Level = z.enum(LEVELS);
export type Level = z.infer<typeof Level>;

export const TopicStatus = z.enum(['stub', 'draft', 'complete']);
export type TopicStatus = z.infer<typeof TopicStatus>;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be kebab-case (a-z, 0-9, -)');

/** YAML parses unquoted dates into Date objects; normalise everything to YYYY-MM-DD. */
const IsoDate = z
  .union([z.string(), z.date()])
  .transform((v, ctx) => {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: `invalid date: ${String(v)}` });
      return z.NEVER;
    }
    return d.toISOString().slice(0, 10);
  });

export const Group = z.object({
  id: slug,
  title: z.string().min(1),
  description: z.string().min(1),
  /** Short label used in compact UI (badges, filters). */
  shortTitle: z.string().min(1),
});
export type Group = z.infer<typeof Group>;
export const GroupsFile = z.array(Group).min(1);

export const TopicFrontmatter = z.strictObject({
  id: slug,
  title: z.string().min(1),
  group: slug,
  tags: z.array(z.string().min(1)).default([]),
  level: Level,
  estimatedMinutes: z.number().int().positive(),
  related: z.array(slug).default([]),
  lastReviewed: IsoDate,
  status: TopicStatus.default('stub'),
});
export type TopicFrontmatter = z.output<typeof TopicFrontmatter>;

export const SECTIONS = [
  { id: 'tldr', heading: 'TL;DR' },
  { id: 'core-concepts', heading: 'Core Concepts' },
  { id: 'how-it-works', heading: 'How It Works' },
  { id: 'trade-offs', heading: 'When to Use / Trade-offs' },
  { id: 'pitfalls', heading: 'Common Pitfalls & Anti-patterns' },
  { id: 'scenario', heading: 'Real-world Scenario' },
  { id: 'interview-questions', heading: 'Interview Questions' },
  { id: 'cheat-sheet', heading: 'Cheat Sheet' },
  { id: 'further-reading', heading: 'Further Reading' },
] as const;
export type SectionId = (typeof SECTIONS)[number]['id'];

export interface Section {
  id: SectionId;
  title: string;
  html: string;
}

export interface Question {
  /** Stable id, unique within the topic. Review history is keyed on `${topicId}#${id}`. */
  id: string;
  topicId: string;
  question: string;
  level: Level;
  modelAnswerHtml: string;
  lookingForHtml: string;
  /** One HTML fragment per bullet. */
  followUpsHtml: string[];
  /** One HTML fragment per bullet. */
  redFlagsHtml: string[];
}

export interface Flashcard {
  id: string;
  topicId: string;
  /** Plain text. For bullets without a `**Front** — back` shape this is a recall prompt. */
  front: string;
  backHtml: string;
}

export interface TopicMeta extends TopicFrontmatter {
  questionCount: number;
  questionLevels: Record<Level, number>;
  verifyCount: number;
}

export interface Topic {
  meta: TopicMeta;
  sections: Section[];
  questions: Question[];
  flashcards: Flashcard[];
}

export const PathStep = z.strictObject({
  topicId: slug,
  note: z.string().optional(),
  optional: z.boolean().default(false),
});
export const LearningPath = z.strictObject({
  id: slug,
  title: z.string().min(1),
  description: z.string().min(1),
  steps: z.array(PathStep).min(1),
});
export type LearningPath = z.output<typeof LearningPath>;
export const PathsFile = z.array(LearningPath);

/** Shape of src/generated/manifest.json — small, loaded eagerly. */
export interface Manifest {
  generatedAt: string;
  groups: Group[];
  topics: TopicMeta[];
  paths: LearningPath[];
}
