/**
 * Turns Cheat Sheet bullets into flashcards.
 *
 * A bullet becomes a card when it starts with bold text followed by a separator:
 *   - **Cache-aside** — app reads cache, falls back to DB, then populates the cache.
 *   - **Cache-aside**: app reads cache, ...
 * The bold text is the front; everything after the separator is the back.
 * Bullets without that shape still show in the cheat sheet but are not cards.
 */
import type { RootContent, List, ListItem, PhrasingContent } from 'mdast';
import { toString } from 'mdast-util-to-string';
import GithubSlugger from 'github-slugger';
import type { Flashcard } from '../../src/lib/content/schema.ts';
import { renderInline } from './markdown.ts';

// "—", "–" or ":" directly after the bold text, or a spaced hyphen (" - ") so "**X**-ish" isn't a card.
const SEPARATOR = /^(?:\s*[—–:]\s*|\s+-\s+)/;

function collectItems(nodes: RootContent[]): ListItem[] {
  // Only top-level lists in the section (and lists under H3 sub-headings); nested bullets stay with their parent.
  return nodes.filter((n): n is List => n.type === 'list').flatMap((l) => l.children);
}

export async function parseCheatSheet(
  topicId: string,
  nodes: RootContent[],
): Promise<{ flashcards: Flashcard[]; skipped: number }> {
  const slugger = new GithubSlugger();
  const flashcards: Flashcard[] = [];
  let skipped = 0;

  for (const item of collectItems(nodes)) {
    const [firstBlock, ...restBlocks] = item.children;
    const firstInline = firstBlock?.type === 'paragraph' ? firstBlock.children[0] : undefined;
    if (!firstBlock || firstBlock.type !== 'paragraph' || firstInline?.type !== 'strong') {
      skipped++;
      continue;
    }

    const front = toString(firstInline).replace(/:$/, '').trim();
    const after: PhrasingContent[] = firstBlock.children.slice(1);
    const lead = after[0];
    const hasSeparator = (lead?.type === 'text' && SEPARATOR.test(lead.value)) || toString(firstInline).trim().endsWith(':');
    if (!hasSeparator) {
      skipped++;
      continue;
    }
    if (lead?.type === 'text') {
      const value = lead.value.replace(SEPARATOR, '').trimStart();
      if (value) after[0] = { ...lead, value };
      else after.shift();
    }

    const backNodes: RootContent[] = [
      ...(after.length ? [{ type: 'paragraph' as const, children: after }] : []),
      ...(restBlocks as RootContent[]),
    ];
    if (!front || backNodes.length === 0) {
      skipped++;
      continue;
    }

    flashcards.push({
      id: `fc-${slugger.slug(front)}`,
      topicId,
      front,
      backHtml: await renderInline(backNodes),
    });
  }

  return { flashcards, skipped };
}
