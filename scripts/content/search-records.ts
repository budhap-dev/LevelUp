import type { RootContent, Heading, Nodes } from 'mdast';
import { toString } from 'mdast-util-to-string';
import type { Flashcard, Question, SearchRecord, TopicFrontmatter } from '../../src/lib/content/schema.ts';
import type { RawSection } from './parse-sections.ts';

const SNIPPET = 220;

/** Node types whose children are inline: their text is joined without separators. */
const INLINE_PARENTS = new Set(['paragraph', 'heading', 'emphasis', 'strong', 'delete', 'link', 'linkReference', 'tableCell']);

function textOf(node: Nodes): string {
  if (node.type === 'code' || node.type === 'html') return ''; // noise for search
  if (node.type === 'break') return ' ';
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node) return (node.children as Nodes[]).map(textOf).join(INLINE_PARENTS.has(node.type) ? '' : ' ');
  return '';
}

/** Plain text of nodes with spaces between blocks, list items and table cells; skips code and HTML. */
export function plainText(nodes: RootContent[]): string {
  return nodes.map(textOf).join(' ').replace(/\s+/g, ' ').trim();
}

const NAMED_ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };

/** Decode the entities rehype-stringify emits: named (&amp;) and numeric (&#x26; / &#38;). */
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Good-enough HTML → text for snippets of HTML we generated ourselves. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

const clip = (s: string, n = SNIPPET) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')}…` : s);

const headingId = (h: Heading) => (h.data?.hProperties as { id?: string } | undefined)?.id;

/** Sections that are covered by their own record types. */
const SKIP_SECTIONS = new Set(['interview-questions', 'cheat-sheet', 'further-reading']);

export function buildSearchRecords(
  meta: TopicFrontmatter,
  sections: RawSection[],
  questions: Question[],
  flashcards: Flashcard[],
): SearchRecord[] {
  const base = { topicId: meta.id, topicTitle: meta.title, tags: meta.tags };
  const tldr = sections.find((s) => s.id === 'tldr');
  const records: SearchRecord[] = [
    {
      ...base,
      id: `${meta.id}`,
      kind: 'topic',
      title: meta.title,
      text: clip(tldr ? plainText(tldr.nodes) : ''),
      level: meta.level,
    },
  ];

  for (const section of sections) {
    if (SKIP_SECTIONS.has(section.id) || section.id === 'tldr') continue;

    // Split the section at its H3s: the intro becomes the section record, each H3 its own record.
    const parts: { title: string; anchor: string; nodes: RootContent[] }[] = [{ title: section.title, anchor: section.id, nodes: [] }];
    for (const node of section.nodes) {
      if (node.type === 'heading' && node.depth === 3) {
        parts.push({ title: toString(node), anchor: headingId(node) ?? section.id, nodes: [] });
      } else {
        parts.at(-1)!.nodes.push(node);
      }
    }
    for (const [i, part] of parts.entries()) {
      const text = plainText(part.nodes);
      if (i === 0 && !text) continue; // section with only sub-headings
      records.push({
        ...base,
        id: `${meta.id}#${part.anchor}${i === 0 ? '' : `@${i}`}`,
        kind: 'section',
        title: part.title,
        text: clip(text),
        anchor: part.anchor,
      });
    }
  }

  for (const q of questions) {
    records.push({
      ...base,
      id: `${meta.id}#q-${q.id}`,
      kind: 'question',
      title: q.question,
      text: clip(htmlToText(q.modelAnswerHtml)),
      level: q.level,
      anchor: `q-${q.id}`,
    });
  }

  for (const card of flashcards) {
    records.push({
      ...base,
      id: `${meta.id}#${card.id}`,
      kind: 'cheat',
      title: card.front,
      text: clip(htmlToText(card.backHtml)),
      anchor: 'cheat-sheet',
    });
  }

  return records;
}
