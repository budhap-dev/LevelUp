import type { ReactNode } from 'react';
import type { Level, TopicStatus } from '@/lib/content/schema';

/** Tones are theme tokens, so badges follow the active theme. `warning` is the one fixed hue. */
const TONES = {
  neutral: 'bg-subtle text-fg-soft border-line',
  soft: 'bg-accent-soft text-accent-ink border-accent-soft',
  strong: 'bg-accent text-on-accent border-accent',
  outline: 'bg-transparent text-muted border-line border-dashed',
  warning: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Foundation → Senior → Architect reads as increasing emphasis in every theme. */
const LEVEL_TONE: Record<Level, Tone> = { Foundation: 'neutral', Senior: 'soft', Architect: 'strong' };
export const LevelBadge = ({ level }: { level: Level }) => <Badge tone={LEVEL_TONE[level]}>{level}</Badge>;

export function StatusBadge({ status }: { status: TopicStatus }) {
  if (status === 'complete') return null;
  return status === 'draft' ? <Badge tone="outline">Draft</Badge> : <Badge tone="outline">Coming soon</Badge>;
}
