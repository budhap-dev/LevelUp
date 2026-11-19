import type { Root, RootContent, Heading } from 'mdast';
import { toString } from 'mdast-util-to-string';
import { SECTIONS, type SectionId } from '../../src/lib/content/schema.ts';

export interface RawSection {
  id: SectionId;
  title: string;
  nodes: RootContent[];
}

export interface SplitResult {
  sections: RawSection[];
  /** Content before the first H2 (should be empty). */
  preamble: RootContent[];
  problems: string[];
}

const normalise = (s: string) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

const HEADING_TO_ID = new Map<string, SectionId>(SECTIONS.map((s) => [normalise(s.heading), s.id]));

const isH2 = (n: RootContent): n is Heading => n.type === 'heading' && n.depth === 2;

/**
 * Split a document into the fixed sections by their H2 headings.
 * Headings are matched case-insensitively, ignoring punctuation and "&" vs "and".
 * Sections are returned in canonical order regardless of order in the file.
 */
export function splitSections(root: Root): SplitResult {
  const problems: string[] = [];
  const found = new Map<SectionId, RawSection>();
  const preamble: RootContent[] = [];
  let current: RawSection | null = null;

  for (const node of root.children) {
    if (isH2(node)) {
      const title = toString(node);
      const id = HEADING_TO_ID.get(normalise(title));
      if (!id) {
        problems.push(
          `unknown section heading "## ${title}". Expected one of: ${SECTIONS.map((s) => s.heading).join(', ')}`,
        );
        current = null;
        continue;
      }
      if (found.has(id)) {
        problems.push(`duplicate section "## ${title}"`);
        current = null;
        continue;
      }
      current = { id, title: SECTIONS.find((s) => s.id === id)!.heading, nodes: [] };
      found.set(id, current);
      continue;
    }
    if (current) current.nodes.push(node);
    else if (found.size === 0) preamble.push(node);
    // Nodes under an unknown/duplicate heading are dropped; the problem is already reported.
  }

  const sections = SECTIONS.flatMap((s) => (found.has(s.id) ? [found.get(s.id)!] : []));
  return { sections, preamble, problems };
}
