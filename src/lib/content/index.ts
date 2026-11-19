/**
 * Client-side access to compiled content (src/generated, produced by scripts/content).
 * The manifest is small and bundled eagerly; each topic is a lazily loaded chunk.
 */
import type { Group, LearningPath, Manifest, Topic, TopicMeta } from './schema';

const manifestModule = import.meta.glob<Manifest>('/src/generated/manifest.json', { eager: true, import: 'default' });
const manifest = Object.values(manifestModule)[0];
if (!manifest) throw new Error('Content manifest missing. Run "npm run content" (or "npm run dev", which runs it).');

const topicLoaders = import.meta.glob<Topic>('/src/generated/topics/*.json', { import: 'default' });

export const groups: readonly Group[] = manifest.groups;
export const topics: readonly TopicMeta[] = manifest.topics;
export const paths: readonly LearningPath[] = manifest.paths;

const topicById = new Map(topics.map((t) => [t.id, t]));
const groupById = new Map(groups.map((g) => [g.id, g]));

export const getTopicMeta = (id: string): TopicMeta | undefined => topicById.get(id);
export const getGroup = (id: string): Group | undefined => groupById.get(id);
export const topicsInGroup = (groupId: string): TopicMeta[] => topics.filter((t) => t.group === groupId);

export async function loadTopic(id: string): Promise<Topic | undefined> {
  const load = topicLoaders[`/src/generated/topics/${id}.json`];
  return load ? load() : undefined;
}
