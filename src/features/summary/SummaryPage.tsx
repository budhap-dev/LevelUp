import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { glossaryCount, groups, paths, topics, topicsInGroup } from '@/lib/content';
import type { TopicMeta, TopicStatus } from '@/lib/content/schema';
import { LEVELS, SECTIONS, TARGET_QUESTION_MIX, TARGET_QUESTIONS } from '@/lib/content/constants';
import { Badge, LevelBadge } from '@/components/Badge';
import { Icon, type IconName } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

const STATUS_LABEL: Record<TopicStatus, string> = { complete: 'Complete', draft: 'Draft', stub: 'Not started' };

function StatusPill({ status }: { status: TopicStatus }) {
  return <Badge tone={status === 'complete' ? 'soft' : status === 'draft' ? 'neutral' : 'outline'}>{STATUS_LABEL[status]}</Badge>;
}

function Stat({ label, value, detail, children }: { label: string; value: ReactNode; detail?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-fg tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-sm text-muted">{detail}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

/** One proportional bar split into complete / draft / not started. */
function StatusBar({ list }: { list: readonly TopicMeta[] }) {
  const count = (s: TopicStatus) => list.filter((t) => t.status === s).length;
  const parts: { status: TopicStatus; n: number; className: string }[] = [
    { status: 'complete', n: count('complete'), className: 'bg-accent' },
    { status: 'draft', n: count('draft'), className: 'bg-muted' },
    { status: 'stub', n: count('stub'), className: 'bg-subtle' },
  ];
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
        {parts.map((p) => p.n > 0 && <div key={p.status} className={`${p.className} transition-[width] duration-700`} style={{ width: `${(p.n / list.length) * 100}%` }} />)}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {parts.map((p) => (
          <span key={p.status} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={`size-2 rounded-full ${p.className} ${p.status === 'stub' ? 'border border-line' : ''}`} />
            {STATUS_LABEL[p.status]} {p.n}
          </span>
        ))}
      </p>
    </div>
  );
}

function QuestionMix({ t }: { t: TopicMeta }) {
  return (
    <span className="text-xs text-muted tabular-nums" title="Foundation / Senior / Architect (target 4 / 6 / 5)">
      {LEVELS.map((l) => t.questionLevels[l]).join(' / ')}
    </span>
  );
}

function GroupSection({ groupId, defaultOpen }: { groupId: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const group = groups.find((g) => g.id === groupId)!;
  const list = topicsInGroup(groupId);
  const complete = list.filter((t) => t.status === 'complete').length;
  const questions = list.reduce((n, t) => n + t.questionCount, 0);

  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors hover:bg-subtle sm:p-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h3 className="text-base font-semibold text-fg">{group.title}</h3>
            <span className="text-sm text-muted tabular-nums">
              {complete}/{list.length} complete · {questions} questions
            </span>
          </div>
          <div className="mt-3 max-w-md">
            <ProgressBar value={complete} max={list.length} label={`${group.title}: ${complete} of ${list.length} topics complete`} />
          </div>
        </div>
        <span className="text-lg font-semibold text-fg tabular-nums">{pct(complete, list.length)}%</span>
        <Icon name="chevron" className={`size-4 shrink-0 text-muted transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[44rem] table-fixed text-sm">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-5 py-2 font-medium">Topic</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Level</th>
                <th className="px-3 py-2 font-medium">Questions</th>
                <th className="px-3 py-2 font-medium">F / S / A</th>
                <th className="px-3 py-2 font-medium">Flashcards</th>
                <th className="px-3 py-2 font-medium">Sections</th>
                <th className="px-3 py-2 font-medium" title="Claims marked VERIFY: that still need checking">To verify</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="px-5 py-2.5">
                    <Link to={`/topics/${t.id}`} className="font-medium text-fg hover:text-accent-ink hover:underline">
                      {t.title}
                    </Link>
                    <span className="ml-2 text-xs text-muted">{t.estimatedMinutes} min</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={t.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <LevelBadge level={t.level} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    <span className={t.questionCount >= TARGET_QUESTIONS ? 'text-fg' : 'text-muted'}>
                      {t.questionCount}/{TARGET_QUESTIONS}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <QuestionMix t={t} />
                  </td>
                  <td className="px-3 py-2.5 text-fg-soft tabular-nums">{t.flashcardCount}</td>
                  <td className="px-3 py-2.5 text-fg-soft tabular-nums">
                    {t.sectionIds.length}/{SECTIONS.length}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{t.verifyCount ? <Badge tone="warning">{t.verifyCount}</Badge> : <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const FEATURES: { icon: IconName; title: string; to: string; text: string }[] = [
  { icon: 'dashboard', title: 'Dashboard', to: '/', text: 'Continue where you left off, progress overview, due reviews.' },
  { icon: 'book', title: 'Topic library', to: '/topics', text: 'Nine-section topics with diagrams, filters by group, level, tag and status.' },
  { icon: 'route', title: 'Learning paths', to: '/paths', text: 'Curated sequences for Staff, Solution Architect and Engineering Manager.' },
  { icon: 'chat', title: 'Interview mode', to: '/interview', text: 'Practise questions with model answers and SM-2 spaced repetition.' },
  { icon: 'layers', title: 'Flashcards', to: '/flashcards', text: 'Cheat-sheet bullets as spaced-repetition cards.' },
  { icon: 'bookmark', title: 'Bookmarks & topic notes', to: '/bookmarks', text: 'Save questions and sections; private notes per topic.' },
  { icon: 'note', title: 'Notes', to: '/notes', text: 'Rich-text notes with attachments and Mermaid/draw.io diagrams, synced to the cloud.' },
  { icon: 'glossary', title: 'Glossary', to: '/glossary', text: 'Key terms with definitions, details and use cases.' },
  { icon: 'settings', title: 'Search, themes & offline', to: '/settings', text: 'Ctrl/⌘ K search, 7 themes, export/import, installable PWA that works offline.' },
];

export function SummaryPage() {
  const complete = topics.filter((t) => t.status === 'complete');
  const questions = topics.reduce((n, t) => n + t.questionCount, 0);
  const flashcards = topics.reduce((n, t) => n + t.flashcardCount, 0);
  const verify = topics.reduce((n, t) => n + t.verifyCount, 0);
  const studyHours = Math.round(complete.reduce((n, t) => n + t.estimatedMinutes, 0) / 60);
  const targetQuestions = topics.length * TARGET_QUESTIONS;
  const levelTotals = LEVELS.map((l) => ({ level: l, n: topics.reduce((s, t) => s + t.questionLevels[l], 0), target: topics.length * TARGET_QUESTION_MIX[l] }));
  // Open the groups that still have gaps; finished groups start collapsed.
  const groupHasGaps = (id: string) => topicsInGroup(id).some((t) => t.status !== 'complete');

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight text-fg">Content summary</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Every module in the knowledge base and how complete it is. A topic is complete when it has all {SECTIONS.length} sections, {TARGET_QUESTIONS} interview
        questions ({LEVELS.map((l) => `${TARGET_QUESTION_MIX[l]} ${l}`).join(', ')}) and a cheat sheet.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Topics complete" value={`${pct(complete.length, topics.length)}%`} detail={`${complete.length} of ${topics.length} topics`}>
          <ProgressBar value={complete.length} max={topics.length} label="Topics complete" />
        </Stat>
        <Stat label="Interview questions" value={questions} detail={`of ${targetQuestions} target`}>
          <ProgressBar value={questions} max={targetQuestions} label="Interview questions written" />
        </Stat>
        <Stat label="Flashcards" value={flashcards} detail={`${glossaryCount} glossary terms`} />
        <Stat label="Study time" value={`${studyHours} h`} detail={`across complete topics · ${verify} claims marked VERIFY to check`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-fg">Topic status</h2>
          <div className="mt-3">
            <StatusBar list={topics} />
          </div>
          <h2 className="mt-6 text-sm font-semibold text-fg">Questions by level</h2>
          <ul className="mt-3 space-y-3">
            {levelTotals.map(({ level, n, target }) => (
              <li key={level} className="grid grid-cols-[7rem_1fr_5rem] items-center gap-3 text-sm">
                <LevelBadge level={level} />
                <ProgressBar value={n} max={target} label={`${level} questions`} />
                <span className="text-right text-muted tabular-nums">
                  {n}/{target}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-fg">Learning paths</h2>
          <ul className="mt-3 space-y-4">
            {paths.map((p) => {
              const ready = p.steps.filter((s) => topics.find((t) => t.id === s.topicId)?.status === 'complete').length;
              return (
                <li key={p.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <Link to={`/paths/${p.id}`} className="font-medium text-fg hover:text-accent-ink hover:underline">
                      {p.title}
                    </Link>
                    <span className="shrink-0 text-muted tabular-nums">
                      {ready}/{p.steps.length}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar value={ready} max={p.steps.length} label={`${p.title}: ${ready} of ${p.steps.length} steps have complete content`} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-fg">Modules</h2>
      <p className="mt-1 text-sm text-muted">Select a module to see its topics. F / S / A is the Foundation, Senior and Architect question count.</p>
      <div className="mt-4 space-y-3">
        {groups.map((g) => (
          <GroupSection key={g.id} groupId={g.id} defaultOpen={groupHasGaps(g.id)} />
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold text-fg">What's built</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title}>
            <Link to={f.to} className="flex h-full gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                <Icon name={f.icon} className="size-4" />
              </span>
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                  {f.title} <Icon name="check" className="size-3.5 text-accent-ink" />
                </span>
                <span className="mt-0.5 block text-sm text-muted">{f.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
