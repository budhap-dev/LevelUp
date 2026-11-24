import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import { GlossaryFile, GroupsFile, PathsFile, type GlossaryEntry, type Manifest, type SearchRecord, type Topic } from '../../src/lib/content/schema.ts';
import { Diagnostics } from './diagnostics.ts';
import { buildTopic, type BuiltTopic } from './build-topic.ts';

export interface ContentBuild {
  manifest: Manifest;
  topics: Topic[];
  glossary: GlossaryEntry[];
  search: SearchRecord[];
  diagnostics: Diagnostics;
}

async function readJson<S extends z.ZodType>(file: string, schema: S, rel: string, diag: Diagnostics): Promise<z.output<S> | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    diag.error(rel, `could not read JSON: ${(e as Error).message}`);
    return null;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) diag.error(rel, `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    return null;
  }
  return result.data;
}

/** Read, validate and compile everything under the content directory. Never throws on content problems. */
export async function buildContent(contentDir: string): Promise<ContentBuild> {
  const diag = new Diagnostics();
  const groups = (await readJson(path.join(contentDir, 'groups.json'), GroupsFile, 'groups.json', diag)) ?? [];
  const paths = (await readJson(path.join(contentDir, 'paths.json'), PathsFile, 'paths.json', diag)) ?? [];
  const groupIds = new Set(groups.map((g) => g.id));
  // The glossary is optional; a missing file just means no entries.
  const glossaryPath = path.join(contentDir, 'glossary.json');
  const hasGlossary = await readFile(glossaryPath, 'utf8').then(() => true, () => false);
  const glossary = hasGlossary ? ((await readJson(glossaryPath, GlossaryFile, 'glossary.json', diag)) ?? []) : [];

  const dupGroups = groups.filter((g, i) => groups.findIndex((x) => x.id === g.id) !== i);
  dupGroups.forEach((g) => diag.error('groups.json', `duplicate group id "${g.id}"`));

  const entries = await readdir(contentDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!groupIds.has(entry.name)) {
        diag.error(`${entry.name}/`, `folder is not a group in groups.json`);
        continue;
      }
      const inner = await readdir(path.join(contentDir, entry.name), { withFileTypes: true });
      for (const f of inner) {
        if (f.isFile() && f.name.endsWith('.md')) files.push(`${entry.name}/${f.name}`);
        else if (f.isFile() && f.name.endsWith('.mdx')) diag.error(`${entry.name}/${f.name}`, 'use .md, not .mdx');
      }
    } else if (entry.isFile() && !['groups.json', 'paths.json', 'glossary.json', '_template.md', 'README.md'].includes(entry.name)) {
      diag.warn(entry.name, 'unexpected file in content root (ignored)');
    }
  }
  files.sort();

  const topics: BuiltTopic[] = [];
  for (const file of files) {
    const source = await readFile(path.join(contentDir, file), 'utf8');
    const topic = await buildTopic({ file, source }, diag);
    if (topic) topics.push(topic);
  }

  // Cross-reference checks.
  const byId = new Map<string, BuiltTopic>();
  for (const t of topics) {
    if (byId.has(t.meta.id)) diag.error(`${t.meta.group}/${t.meta.id}.md`, `duplicate topic id "${t.meta.id}"`);
    byId.set(t.meta.id, t);
  }
  for (const t of topics) {
    const file = `${t.meta.group}/${t.meta.id}.md`;
    if (!groupIds.has(t.meta.group)) diag.error(file, `group "${t.meta.group}" is not defined in groups.json`);
    for (const r of t.meta.related) if (!byId.has(r)) diag.error(file, `related topic "${r}" does not exist`);
  }
  for (const p of paths) {
    const seen = new Set<string>();
    for (const step of p.steps) {
      if (!byId.has(step.topicId)) diag.error('paths.json', `path "${p.id}" references unknown topic "${step.topicId}"`);
      if (seen.has(step.topicId)) diag.error('paths.json', `path "${p.id}" lists "${step.topicId}" twice`);
      seen.add(step.topicId);
    }
  }

  const seenTerms = new Map<string, string>();
  for (const g of glossary) {
    const termKey = g.term.toLowerCase();
    if (seenTerms.has(g.id)) diag.error('glossary.json', `duplicate glossary id "${g.id}"`);
    if ([...seenTerms.values()].includes(termKey)) diag.error('glossary.json', `duplicate glossary term "${g.term}"`);
    seenTerms.set(g.id, termKey);
    if (!groupIds.has(g.group)) diag.error('glossary.json', `"${g.id}": group "${g.group}" is not defined in groups.json`);
    for (const r of g.related) if (!byId.has(r)) diag.error('glossary.json', `"${g.id}": related topic "${r}" does not exist`);
  }
  const sortedGlossary = [...glossary].sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }));
  const glossarySearch: SearchRecord[] = sortedGlossary.map((g) => ({
    id: `glossary:${g.id}`,
    kind: 'glossary',
    topicId: g.related[0] ?? '',
    topicTitle: 'Glossary',
    title: g.aka.length ? `${g.term} (${g.aka.join(', ')})` : g.term,
    text: g.definition,
    tags: [],
    anchor: g.id,
  }));

  // Order topics by group order, then by file order within the group.
  const groupOrder = new Map(groups.map((g, i) => [g.id, i]));
  topics.sort((a, b) => (groupOrder.get(a.meta.group) ?? 99) - (groupOrder.get(b.meta.group) ?? 99) || a.meta.title.localeCompare(b.meta.title));

  return {
    manifest: { generatedAt: new Date().toISOString(), groups, topics: topics.map((t) => t.meta), paths, glossaryCount: sortedGlossary.length },
    topics: topics.map(({ search: _search, ...topic }) => topic),
    glossary: sortedGlossary,
    search: [...topics.flatMap((t) => t.search), ...glossarySearch],
    diagnostics: diag,
  };
}

async function writeIfChanged(file: string, content: string) {
  const existing = await readFile(file, 'utf8').catch(() => null);
  if (existing !== content) await writeFile(file, content);
}

/** Write the build to disk, touching only files whose content changed (keeps Vite HMR quiet). */
export async function writeContent(outDir: string, build: ContentBuild) {
  const topicsDir = path.join(outDir, 'topics');
  await mkdir(topicsDir, { recursive: true });

  // generatedAt changes every run, so compare without it to avoid needless rewrites (and HMR reloads).
  const manifestFile = path.join(outDir, 'manifest.json');
  const comparable = (m: Manifest) => JSON.stringify({ ...m, generatedAt: '' });
  const previous = (await readFile(manifestFile, 'utf8').then(JSON.parse).catch(() => null)) as Manifest | null;
  if (!previous || comparable(previous) !== comparable(build.manifest)) {
    await writeFile(manifestFile, JSON.stringify(build.manifest));
  }

  await writeIfChanged(path.join(outDir, 'search.json'), JSON.stringify(build.search));
  await writeIfChanged(path.join(outDir, 'glossary.json'), JSON.stringify(build.glossary));

  const keep = new Set<string>();
  for (const topic of build.topics) {
    const name = `${topic.meta.id}.json`;
    keep.add(name);
    await writeIfChanged(path.join(topicsDir, name), JSON.stringify(topic));
  }
  for (const name of await readdir(topicsDir)) {
    if (!keep.has(name)) await rm(path.join(topicsDir, name));
  }
}
