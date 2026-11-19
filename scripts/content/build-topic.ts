import matter from 'gray-matter';
import GithubSlugger from 'github-slugger';
import { toString } from 'mdast-util-to-string';
import type { Root } from 'mdast';
import {
  LEVELS,
  SECTIONS,
  TopicFrontmatter,
  type Flashcard,
  type Level,
  type Question,
  type Section,
  type Topic,
} from '../../src/lib/content/schema.ts';
import type { Diagnostics } from './diagnostics.ts';
import { parseMarkdown, renderNodes } from './markdown.ts';
import { splitSections } from './parse-sections.ts';
import { parseQuestions } from './parse-questions.ts';
import { parseCheatSheet } from './parse-cheatsheet.ts';

/** Question mix Prompt 2 asks for. Deviations are warnings on complete topics. */
export const TARGET_QUESTION_MIX: Record<Level, number> = { Foundation: 4, Senior: 6, Architect: 5 };

export interface BuildTopicInput {
  /** Path relative to the content root, e.g. "data/caching.md". Used in messages. */
  file: string;
  source: string;
}

/** Give H3+ headings stable ids so the UI can link to them. */
function addHeadingIds(root: Root) {
  const slugger = new GithubSlugger();
  for (const node of root.children) {
    if (node.type === 'heading' && node.depth >= 3) {
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: slugger.slug(toString(node)) } };
    }
  }
}

export async function buildTopic({ file, source }: BuildTopicInput, diag: Diagnostics): Promise<Topic | null> {
  let parsed: matter.GrayMatterFile<string>;
  try {
    // gray-matter caches by content; pass an options object to disable that.
    parsed = matter(source, {});
  } catch (e) {
    diag.error(file, `invalid YAML frontmatter: ${(e as Error).message}`);
    return null;
  }

  const fm = TopicFrontmatter.safeParse(parsed.data);
  if (!fm.success) {
    for (const issue of fm.error.issues) {
      diag.error(file, `frontmatter ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    return null;
  }
  const meta = fm.data;
  const strict = meta.status === 'complete';
  const report = (required: boolean, message: string) =>
    required || strict ? diag.error(file, message) : diag.warn(file, message);

  const expectedPath = `${meta.group}/${meta.id}.md`;
  if (file !== expectedPath) diag.error(file, `file should live at content/${expectedPath} (group/id.md)`);
  if (meta.related.includes(meta.id)) diag.error(file, 'related[] must not include the topic itself');

  const root = parseMarkdown(parsed.content);
  addHeadingIds(root);
  const { sections: rawSections, preamble, problems } = splitSections(root);
  problems.forEach((p) => diag.error(file, p));
  if (preamble.some((n) => n.type !== 'html')) {
    diag.warn(file, 'content before the first "## " section heading is ignored');
  }

  if (meta.status !== 'stub') {
    const present = new Set(rawSections.map((s) => s.id));
    const missing = SECTIONS.filter((s) => !present.has(s.id)).map((s) => s.heading);
    if (missing.length) report(false, `missing sections: ${missing.join(', ')}`);
  }

  const sections: Section[] = [];
  let questions: Question[] = [];
  let flashcards: Flashcard[] = [];

  for (const raw of rawSections) {
    sections.push({ id: raw.id, title: raw.title, html: await renderNodes(raw.nodes) });

    if (raw.id === 'interview-questions') {
      const result = await parseQuestions(meta.id, raw.nodes);
      questions = result.questions;
      result.problems.forEach((p) => report(p.required, p.message));
    }
    if (raw.id === 'cheat-sheet') {
      const result = await parseCheatSheet(meta.id, raw.nodes);
      flashcards = result.flashcards;
      if (result.skipped > 0 && meta.status !== 'stub') {
        diag.warn(file, `${result.skipped} cheat-sheet bullet(s) are not in "**Front** — back" form and won't become flashcards`);
      }
    }
  }

  const questionLevels = Object.fromEntries(LEVELS.map((l) => [l, questions.filter((q) => q.level === l).length])) as Record<Level, number>;
  if (strict) {
    const off = LEVELS.filter((l) => questionLevels[l] < TARGET_QUESTION_MIX[l]);
    if (off.length) {
      diag.warn(file, `question mix ${LEVELS.map((l) => `${l} ${questionLevels[l]}`).join(', ')} is below the target ${LEVELS.map((l) => `${l} ${TARGET_QUESTION_MIX[l]}`).join(', ')}`);
    }
  }

  const verifyCount = (parsed.content.match(/\bVERIFY:/g) ?? []).length;

  return {
    meta: { ...meta, questionCount: questions.length, questionLevels, verifyCount },
    sections,
    questions,
    flashcards,
  };
}
