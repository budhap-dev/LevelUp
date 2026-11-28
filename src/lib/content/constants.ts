/**
 * Runtime constants shared by the app and the content pipeline.
 * Kept free of Zod so importing them doesn't pull the schema library into the app bundle.
 */
export const LEVELS = ['Foundation', 'Senior', 'Architect'] as const;
export type Level = (typeof LEVELS)[number];

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

/** Interview-question mix a complete topic aims for (20 in total). */
export const TARGET_QUESTION_MIX: Record<Level, number> = { Foundation: 5, Senior: 8, Architect: 7 };
export const TARGET_QUESTIONS = Object.values(TARGET_QUESTION_MIX).reduce((a, b) => a + b, 0);
