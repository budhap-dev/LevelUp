/**
 * Parses the "Interview Questions" section. Expected shape (see content/_template.md):
 *
 *   ### How does X work? {#stable-id}
 *   **Level:** Senior
 *
 *   **Model answer:**
 *   ...markdown...
 *
 *   **What the interviewer is looking for:**
 *   ...
 *
 *   **Follow-ups:**
 *   - ...
 *
 *   **Red flags:**
 *   - ...
 */
import type { RootContent, Paragraph, PhrasingContent, List } from 'mdast';
import { toString } from 'mdast-util-to-string';
import GithubSlugger from 'github-slugger';
import { LEVELS, type Level, type Question } from '../../src/lib/content/schema.ts';
import { renderInline, renderNodes } from './markdown.ts';

type FieldKey = 'level' | 'modelAnswer' | 'lookingFor' | 'followUps' | 'redFlags';

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const LABELS = new Map<string, FieldKey>([
  ['level', 'level'],
  ['model answer', 'modelAnswer'],
  ['answer', 'modelAnswer'],
  ['what the interviewer is looking for', 'lookingFor'],
  ['what interviewers look for', 'lookingFor'],
  ['looking for', 'lookingFor'],
  ['follow ups', 'followUps'],
  ['follow up questions', 'followUps'],
  ['follow up', 'followUps'],
  ['red flags', 'redFlags'],
  ['red flag answers', 'redFlags'],
]);

export interface QuestionProblem {
  message: string;
  /** Required problems make the question unusable; others are quality issues. */
  required: boolean;
}

export interface ParsedQuestions {
  questions: Question[];
  problems: QuestionProblem[];
}

const ID_SUFFIX = /\s*\{#([a-z0-9]+(?:-[a-z0-9]+)*)\}\s*$/;

/** If this paragraph starts a labelled field, return the field and the content after the label. */
function matchField(node: RootContent): { key: FieldKey; rest: Paragraph | null } | null {
  if (node.type !== 'paragraph') return null;
  const [first, ...others] = node.children;
  if (!first || first.type !== 'strong') return null;

  const labelRaw = toString(first).trim();
  const next = others[0];
  const colonInside = labelRaw.endsWith(':');
  const colonAfter = next?.type === 'text' && /^\s*:/.test(next.value);
  if (!colonInside && !colonAfter) return null;

  const key = LABELS.get(normalise(labelRaw.replace(/:$/, '')));
  if (!key) return null;

  const rest: PhrasingContent[] = [...others];
  if (rest[0]?.type === 'text') {
    const value = rest[0].value.replace(/^\s*:?\s*/, '');
    if (value) rest[0] = { ...rest[0], value };
    else rest.shift();
  }
  // A soft line break straight after the label ("**Level:**\nSenior") is not content.
  while (rest[0]?.type === 'break') rest.shift();
  return { key, rest: rest.length ? { type: 'paragraph', children: rest } : null };
}

async function renderListItems(nodes: RootContent[]): Promise<string[]> {
  const lists = nodes.filter((n): n is List => n.type === 'list');
  if (lists.length === 0) {
    const html = await renderNodes(nodes);
    return html ? [html] : [];
  }
  const items = lists.flatMap((l) => l.children);
  return Promise.all(items.map((item) => renderInline(item.children as RootContent[])));
}

function makeId(text: string, slugger: GithubSlugger): string {
  const words = text.replace(/[`*_]/g, '').split(/\s+/).slice(0, 8).join(' ');
  return slugger.slug(words) || slugger.slug('question');
}

export async function parseQuestions(topicId: string, nodes: RootContent[]): Promise<ParsedQuestions> {
  const problems: QuestionProblem[] = [];
  const questions: Question[] = [];
  const slugger = new GithubSlugger();
  const seenIds = new Set<string>();

  // Group nodes under their H3.
  const groups: { heading: string; nodes: RootContent[] }[] = [];
  for (const node of nodes) {
    if (node.type === 'heading' && node.depth === 3) {
      groups.push({ heading: toString(node), nodes: [] });
    } else if (node.type === 'heading' && node.depth < 3) {
      problems.push({ message: `unexpected heading "${toString(node)}" inside Interview Questions`, required: true });
    } else if (groups.length) {
      groups.at(-1)!.nodes.push(node);
    }
    // Intro text before the first question is allowed and ignored.
  }

  for (const group of groups) {
    const idMatch = ID_SUFFIX.exec(group.heading);
    const questionText = group.heading.replace(ID_SUFFIX, '').trim();
    const label = `question "${questionText.slice(0, 60)}${questionText.length > 60 ? '…' : ''}"`;

    let id: string;
    if (idMatch) {
      id = idMatch[1]!;
      slugger.slug(id); // reserve it so generated ids don't collide
    } else {
      id = makeId(questionText, slugger);
      problems.push({ message: `${label} has no {#id}; using generated id "${id}". Add an explicit id so review history survives rewording.`, required: false });
    }
    if (seenIds.has(id)) {
      problems.push({ message: `${label}: duplicate question id "${id}"`, required: true });
      continue;
    }
    seenIds.add(id);

    const fields = new Map<FieldKey, RootContent[]>();
    let current: FieldKey | null = null;
    for (const node of group.nodes) {
      const field = matchField(node);
      if (field) {
        if (fields.has(field.key)) problems.push({ message: `${label}: field "${field.key}" appears twice`, required: true });
        current = field.key;
        fields.set(current, field.rest ? [field.rest] : []);
      } else if (current) {
        fields.get(current)!.push(node);
      } else {
        problems.push({ message: `${label}: content before the first labelled field is ignored`, required: false });
      }
    }

    const levelText = toString({ type: 'root', children: fields.get('level') ?? [] }).trim();
    const level = LEVELS.find((l) => l.toLowerCase() === levelText.toLowerCase()) as Level | undefined;

    const missing: string[] = [];
    if (!level) missing.push(levelText ? `valid Level (got "${levelText}"; expected ${LEVELS.join(' | ')})` : 'Level');
    if (!fields.get('modelAnswer')?.length) missing.push('Model answer');
    if (!fields.get('lookingFor')?.length) missing.push('What the interviewer is looking for');
    if (missing.length) {
      problems.push({ message: `${label} is missing: ${missing.join(', ')}`, required: true });
      continue;
    }
    if (!fields.get('followUps')?.length) problems.push({ message: `${label} has no Follow-ups`, required: false });
    if (!fields.get('redFlags')?.length) problems.push({ message: `${label} has no Red flags`, required: false });

    questions.push({
      id,
      topicId,
      question: questionText,
      level: level!,
      modelAnswerHtml: await renderNodes(fields.get('modelAnswer')!),
      lookingForHtml: await renderNodes(fields.get('lookingFor')!),
      followUpsHtml: await renderListItems(fields.get('followUps') ?? []),
      redFlagsHtml: await renderListItems(fields.get('redFlags') ?? []),
    });
  }

  return { questions, problems };
}
