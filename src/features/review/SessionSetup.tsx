import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { groups, loadTopic, topics } from '@/lib/content';
import { LEVELS, type Level } from '@/lib/content/constants';
import type { Topic, TopicMeta } from '@/lib/content/schema';
import { Icon } from '@/components/Icon';
import { groupIcon } from '@/components/groupIcons';

export const CONTENT_TOPICS = topics.filter((t) => t.status !== 'stub');

export interface SetupState {
  topicIds: string[];
  levels: Level[];
  size: number;
  ahead: boolean;
}

export const SIZES = [5, 10, 20, 50] as const;

const DEFAULT_SETUP: SetupState = { topicIds: CONTENT_TOPICS.map((t) => t.id), levels: [...LEVELS], size: 10, ahead: false };

/** Remember the last setup per mode (a per-browser convenience; safe to lose). */
export function usePersistedSetup(mode: string): [SetupState, (s: SetupState) => void] {
  const key = `levelup:review-setup:${mode}`;
  const [state, setState] = useState<SetupState>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<SetupState> | null;
      if (!raw) return DEFAULT_SETUP;
      const valid = new Set(CONTENT_TOPICS.map((t) => t.id));
      return {
        topicIds: (raw.topicIds ?? DEFAULT_SETUP.topicIds).filter((id) => valid.has(id)),
        levels: (raw.levels ?? DEFAULT_SETUP.levels).filter((l) => LEVELS.includes(l)),
        size: SIZES.includes(raw.size as (typeof SIZES)[number]) ? raw.size! : DEFAULT_SETUP.size,
        ahead: !!raw.ahead,
      };
    } catch {
      return DEFAULT_SETUP;
    }
  });
  const save = (s: SetupState) => {
    setState(s);
    try {
      localStorage.setItem(key, JSON.stringify(s));
    } catch {
      /* fine: just not remembered */
    }
  };
  return [state, save];
}

/** Load topic JSON for the given ids (lazy chunks), keeping already-loaded ones. */
export function useLoadedTopics(ids: string[]): { loaded: Map<string, Topic>; ready: boolean } {
  const [loaded, setLoaded] = useState<Map<string, Topic>>(new Map());
  const key = ids.join('|');
  useEffect(() => {
    let cancelled = false;
    const missing = ids.filter((id) => !loaded.has(id));
    if (missing.length === 0) return;
    void Promise.all(missing.map((id) => loadTopic(id))).then((results) => {
      if (cancelled) return;
      setLoaded((prev) => {
        const next = new Map(prev);
        results.forEach((t) => t && next.set(t.meta.id, t));
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [key]); // `key` stands in for `ids`; `loaded` is only read to skip work already done
  return { loaded, ready: ids.every((id) => loaded.has(id)) };
}

/** Selectable pill with a tick that fills in when chosen; `count` is decorative (aria-hidden) so the accessible name stays the label. */
function Chip({ label, checked, onToggle, count }: { label: string; checked: boolean; onToggle: () => void; count?: number }) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border py-1.5 pr-3 pl-1.5 text-sm transition-[background-color,border-color,color,scale] duration-200 ease-(--ease-out-expo) select-none active:scale-[0.97] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${
        checked ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-fg-soft hover:border-accent hover:text-fg'
      }`}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onToggle} />
      <span
        aria-hidden="true"
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
          checked ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-transparent'
        }`}
      >
        <Icon name="check" className={`size-3 transition-transform duration-300 ease-(--ease-out-expo) ${checked ? 'scale-100' : 'scale-0'}`} />
      </span>
      <span className="leading-snug">{label}</span>
      {count !== undefined && (
        <span aria-hidden="true" className={`text-xs tabular-nums ${checked ? 'text-accent-ink/70' : 'text-muted'}`}>
          {count}
        </span>
      )}
    </label>
  );
}

/** Group-level checkbox: checked when every topic is chosen, mixed when some are. */
function GroupToggle({ label, chosen, total, onChange }: { label: string; chosen: number; total: number; onChange: (all: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = chosen > 0 && chosen < total;
  }, [chosen, total]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={`All ${label}`}
      checked={chosen === total}
      onChange={() => onChange(chosen < total)}
      className="size-4 shrink-0 cursor-pointer accent-accent"
    />
  );
}

function Field({ legend, hint, actions, children }: { legend: string; hint?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-5 first:border-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm font-semibold text-fg">
          {legend}
          {hint && <span className="ml-2 text-xs font-normal text-muted">{hint}</span>}
        </legend>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

export function SessionSetup({
  state,
  onChange,
  showLevels,
  counts,
  unit,
  onStart,
}: {
  state: SetupState;
  onChange: (s: SetupState) => void;
  showLevels: boolean;
  counts: { due: number; fresh: number; later: number } | null;
  unit: string;
  onStart: () => void;
}) {
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const available = counts ? counts.due + counts.fresh + (state.ahead ? counts.later : 0) : 0;
  const sessionSize = Math.min(state.size, available);
  const selected = new Set(state.topicIds);
  const baseId = useId();
  // Groups start expanded on wider screens and collapsed on phones, where the full list is very long.
  const [open, setOpen] = useState<Set<string>>(() =>
    typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 639px)').matches ? new Set() : new Set(groups.map((g) => g.id)),
  );
  const toggleOpen = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setGroup = (ids: string[], all: boolean) =>
    onChange({ ...state, topicIds: all ? [...new Set([...state.topicIds, ...ids])] : state.topicIds.filter((id) => !ids.includes(id)) });
  /** Questions at the chosen levels in interview mode; flashcards otherwise. */
  const countOf = (t: TopicMeta) => (showLevels ? state.levels.reduce((n, l) => n + (t.questionLevels[l] ?? 0), 0) : t.flashcardCount);

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <Field
        legend="Topics"
        hint={`${state.topicIds.length} of ${CONTENT_TOPICS.length} chosen`}
        actions={
          <div className="flex gap-1 text-sm">
            <button type="button" className="rounded-md px-2 py-1 text-accent-ink hover:bg-accent-soft" onClick={() => onChange({ ...state, topicIds: CONTENT_TOPICS.map((t) => t.id) })}>
              All
            </button>
            <button type="button" className="rounded-md px-2 py-1 text-accent-ink hover:bg-accent-soft" onClick={() => onChange({ ...state, topicIds: [] })}>
              None
            </button>
          </div>
        }
      >
        <div className="columns-1 gap-3 sm:columns-2">
          {groups
            .map((g) => ({ g, items: CONTENT_TOPICS.filter((t) => t.group === g.id) }))
            .filter(({ items }) => items.length)
            .map(({ g, items }, i) => {
              const chosen = items.filter((t) => selected.has(t.id)).length;
              const isOpen = open.has(g.id);
              const bodyId = `${baseId}-${g.id}`;
              return (
                <section
                  key={g.id}
                  aria-label={g.title}
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                  className={`mb-3 animate-page-in break-inside-avoid rounded-xl border p-3.5 transition-colors duration-200 ${chosen ? 'border-accent/40 bg-accent-soft/30' : 'border-line bg-subtle/40'}`}
                >
                  <header className="flex items-center gap-3">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${chosen ? 'bg-accent text-on-accent' : 'bg-subtle text-muted'}`}
                    >
                      <Icon name={groupIcon(g.id)} className="size-4.5" />
                    </span>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={bodyId}
                      onClick={() => toggleOpen(g.id)}
                      className="group/head flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-fg">{g.title}</span>
                        <span className="block text-xs text-muted">
                          {chosen} of {items.length} chosen
                        </span>
                      </span>
                      <Icon
                        name="chevron"
                        className={`size-4 shrink-0 text-muted transition-transform duration-300 ease-(--ease-out-expo) group-hover/head:text-fg ${isOpen ? 'rotate-90' : ''}`}
                      />
                    </button>
                    <GroupToggle label={g.title} chosen={chosen} total={items.length} onChange={(all) => setGroup(items.map((t) => t.id), all)} />
                  </header>
                  <div id={bodyId} hidden={!isOpen} className="mt-3 flex flex-wrap gap-1.5">
                    {items.map((t) => (
                      <Chip
                        key={t.id}
                        label={t.title}
                        checked={selected.has(t.id)}
                        count={countOf(t)}
                        onToggle={() => onChange({ ...state, topicIds: toggle(state.topicIds, t.id) })}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
        </div>
      </Field>

      {showLevels && (
        <Field legend="Levels">
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <Chip key={l} label={l} checked={state.levels.includes(l)} onToggle={() => onChange({ ...state, levels: toggle(state.levels, l) })} />
            ))}
          </div>
        </Field>
      )}

      <Field legend="Session">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm text-fg-soft">
            Up to
            <select
              value={state.size}
              onChange={(e) => onChange({ ...state, size: Number(e.target.value) })}
              className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-fg hover:border-accent"
            >
              {SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {unit}
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg-soft">
            <input type="checkbox" role="switch" checked={state.ahead} onChange={(e) => onChange({ ...state, ahead: e.target.checked })} className="peer sr-only" />
            <span
              aria-hidden="true"
              className="relative h-6 w-10 rounded-full border border-line bg-subtle transition-colors duration-200 peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-4.5 after:rounded-full after:bg-surface after:transition-transform after:duration-300 after:ease-(--ease-out-expo) peer-checked:after:translate-x-4"
            />
            Practise ahead (include {unit} not due yet)
          </label>
        </div>
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {counts ? (
            <>
              <span className="font-medium text-fg">{counts.due}</span> due · <span className="font-medium text-fg">{counts.fresh}</span> new ·{' '}
              <span className="font-medium text-fg">{counts.later}</span> scheduled later
            </>
          ) : (
            'Loading…'
          )}
        </p>
        <button
          type="button"
          onClick={onStart}
          disabled={!counts || sessionSize === 0}
          className="h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sessionSize ? `Start ${sessionSize} ${unit}` : `No ${unit} to review`}
        </button>
      </div>
      {counts && sessionSize === 0 && (state.topicIds.length === 0 || (showLevels && state.levels.length === 0) ? (
        <p className="text-sm text-muted">Choose at least one topic{showLevels ? ' and level' : ''}.</p>
      ) : (
        <p className="text-sm text-muted">Nothing is due right now. Turn on “Practise ahead” to review early, or add more topics.</p>
      ))}
    </div>
  );
}
