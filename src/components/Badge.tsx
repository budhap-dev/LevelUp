import type { ReactNode } from 'react';
import type { Level, TopicStatus } from '@/lib/content/schema';

const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900',
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = 'slate', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const LEVEL_TONE: Record<Level, Tone> = { Foundation: 'emerald', Senior: 'indigo', Architect: 'violet' };
export const LevelBadge = ({ level }: { level: Level }) => <Badge tone={LEVEL_TONE[level]}>{level}</Badge>;

export function StatusBadge({ status }: { status: TopicStatus }) {
  if (status === 'complete') return null;
  return status === 'draft' ? <Badge tone="amber">Draft</Badge> : <Badge>Coming soon</Badge>;
}
