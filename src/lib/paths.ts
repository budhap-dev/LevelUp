import type { LearningPath, TopicMeta } from '@/lib/content/schema';
import { getTopicMeta } from '@/lib/content';
import type { TopicProgress } from '@/lib/progress/types';

export interface PathStepView {
  meta: TopicMeta;
  note?: string;
  optional: boolean;
  learned: boolean;
}

export interface PathProgress {
  steps: PathStepView[];
  /** Required steps only; optional steps never block completion. */
  required: number;
  learned: number;
  /** First required step not yet learned (falls back to the first unlearned optional one). */
  next?: PathStepView;
}

/** Pure: joins a path with topic metadata and the learner's progress. */
export function pathProgress(path: LearningPath, progress: Readonly<Record<string, TopicProgress>>): PathProgress {
  const steps = path.steps.flatMap((s) => {
    const meta = getTopicMeta(s.topicId);
    // The pipeline already rejects unknown ids; this only guards stale generated data.
    return meta ? [{ meta, note: s.note, optional: s.optional, learned: progress[s.topicId]?.state === 'learned' }] : [];
  });
  const required = steps.filter((s) => !s.optional);
  return {
    steps,
    required: required.length,
    learned: required.filter((s) => s.learned).length,
    next: required.find((s) => !s.learned) ?? steps.find((s) => !s.learned),
  };
}
