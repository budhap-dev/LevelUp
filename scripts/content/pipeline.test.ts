// @vitest-environment node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContent } from './pipeline.ts';

const contentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content');

describe('real content', () => {
  it('builds without errors', async () => {
    const build = await buildContent(contentDir);
    expect(build.diagnostics.format(build.diagnostics.errors)).toBe('');
    expect(build.manifest.groups).toHaveLength(10);
    expect(build.topics.length).toBeGreaterThanOrEqual(51);
  });

  it('has one sample (draft or complete) topic per group', async () => {
    const build = await buildContent(contentDir);
    for (const group of build.manifest.groups) {
      const samples = build.manifest.topics.filter((t) => t.group === group.id && t.status !== 'stub');
      expect(samples.length, `group ${group.id}`).toBeGreaterThanOrEqual(1);
    }
  });
});
