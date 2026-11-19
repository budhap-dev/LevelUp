// @vitest-environment node
import { parseMarkdown } from './markdown.ts';
import { splitSections } from './parse-sections.ts';

describe('splitSections', () => {
  it('matches headings loosely and returns sections in canonical order', () => {
    const { sections, problems } = splitSections(
      parseMarkdown(`## cheat sheet\n- a\n\n## tl;dr\n- b\n\n## Common Pitfalls and Anti-patterns\ntext\n`),
    );
    expect(problems).toEqual([]);
    expect(sections.map((s) => s.id)).toEqual(['tldr', 'pitfalls', 'cheat-sheet']);
    expect(sections[0]?.title).toBe('TL;DR');
  });

  it('reports unknown and duplicate headings', () => {
    const { sections, problems } = splitSections(parseMarkdown(`## TL;DR\na\n## Summary\nb\n## TL;DR\nc\n`));
    expect(sections).toHaveLength(1);
    expect(sections[0]?.nodes).toHaveLength(1);
    expect(problems).toEqual([expect.stringMatching(/unknown section heading "## Summary"/), expect.stringMatching(/duplicate section/)]);
  });

  it('keeps H3 and deeper headings inside their section', () => {
    const { sections } = splitSections(parseMarkdown(`## Core Concepts\n### A\ntext\n### B\n`));
    expect(sections[0]?.nodes.map((n) => n.type)).toEqual(['heading', 'paragraph', 'heading']);
  });

  it('collects content before the first section as preamble', () => {
    const { preamble } = splitSections(parseMarkdown(`stray\n\n## TL;DR\n- a\n`));
    expect(preamble).toHaveLength(1);
  });
});
