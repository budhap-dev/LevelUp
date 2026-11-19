// @vitest-environment node
import { buildTopic } from './build-topic.ts';
import { Diagnostics } from './diagnostics.ts';

const fm = (extra = '') => `---
id: caching
title: Caching
group: data
tags: [perf]
level: Senior
estimatedMinutes: 30
related: []
lastReviewed: 2026-11-19
${extra}
---
`;

async function build(source: string, file = 'data/caching.md') {
  const diag = new Diagnostics();
  const topic = await buildTopic({ file, source }, diag);
  return { topic, diag };
}

describe('buildTopic', () => {
  it('defaults status to stub and accepts an empty body', async () => {
    const { topic, diag } = await build(fm());
    expect(diag.items).toEqual([]);
    expect(topic?.meta.status).toBe('stub');
    expect(topic?.meta.lastReviewed).toBe('2026-11-19');
    expect(topic?.sections).toEqual([]);
  });

  it('reports every frontmatter problem', async () => {
    const { topic, diag } = await build(`---\nid: Bad Id\ntitle: X\ngroup: data\nlevel: Guru\nestimatedMinutes: -1\nlastReviewed: nope\nextra: 1\n---\n`);
    expect(topic).toBeNull();
    const messages = diag.errors.map((d) => d.message).join('\n');
    for (const field of ['id', 'level', 'estimatedMinutes', 'lastReviewed']) expect(messages).toContain(`frontmatter ${field}`);
    expect(messages).toMatch(/extra/);
  });

  it('checks the file lives at group/id.md', async () => {
    const { diag } = await build(fm(), 'data/cache.md');
    expect(diag.errors[0]?.message).toMatch(/content\/data\/caching\.md/);
  });

  it('treats missing sections as warnings for drafts and errors for complete topics', async () => {
    const body = `## TL;DR\n- a\n`;
    const draft = await build(fm('status: draft') + body);
    expect(draft.diag.errors).toEqual([]);
    expect(draft.diag.warnings[0]?.message).toMatch(/missing sections: Core Concepts/);

    const complete = await build(fm('status: complete') + body);
    expect(complete.diag.errors[0]?.message).toMatch(/missing sections/);
  });

  it('renders mermaid placeholders, highlighted code, heading ids and counts VERIFY markers', async () => {
    const { topic } = await build(
      fm('status: draft') +
        `## Core Concepts\n### Cache aside\nVERIFY: a claim.\n\n\`\`\`ts\nconst a = 1;\n\`\`\`\n\n## How It Works\n\`\`\`mermaid\nflowchart LR\n  A --> B\n\`\`\`\n\nVERIFY: another.\n`,
    );
    const core = topic!.sections.find((s) => s.id === 'core-concepts')!.html;
    const how = topic!.sections.find((s) => s.id === 'how-it-works')!.html;
    expect(core).toContain('<h3 id="cache-aside">');
    expect(core).toContain('class="shiki');
    expect(how).toContain('<div class="mermaid-diagram" data-mermaid="">flowchart LR\n  A --> B</div>');
    expect(topic!.meta.verifyCount).toBe(2);
  });

  it('drops raw HTML from content', async () => {
    const { topic } = await build(fm('status: draft') + `## TL;DR\n<script>alert(1)</script>\n\n- ok\n`);
    expect(topic!.sections[0]!.html).not.toContain('<script');
  });
});
