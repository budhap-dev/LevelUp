import { useEffect, useState, type ReactNode } from 'react';
import { groups, loadTopic, topics } from '@/lib/content';
import { LEVELS, type Level } from '@/lib/content/constants';
import type { Topic } from '@/lib/content/schema';

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

const chip =
  'cursor-pointer rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-fg-soft transition-colors duration-150 select-none hover:border-accent has-checked:border-accent has-checked:bg-accent has-checked:text-on-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent';

function Field({ legend, actions, children }: { legend: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-5 first:border-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm font-semibold text-fg">{legend}</legend>
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

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <Field
        legend="Topics"
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
        <div className="space-y-3">
          {groups
            .map((g) => ({ g, items: CONTENT_TOPICS.filter((t) => t.group === g.id) }))
            .filter(({ items }) => items.length)
            .map(({ g, items }) => (
              <div key={g.id} className="flex flex-wrap items-center gap-2">
                <span className="w-full text-xs font-medium tracking-wide text-muted uppercase sm:w-44">{g.title}</span>
                {items.map((t) => (
                  <label key={t.id} className={chip}>
                    <input type="checkbox" className="sr-only" checked={state.topicIds.includes(t.id)} onChange={() => onChange({ ...state, topicIds: toggle(state.topicIds, t.id) })} />
                    {t.title}
                  </label>
                ))}
              </div>
            ))}
        </div>
      </Field>

      {showLevels && (
        <Field legend="Levels">
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <label key={l} className={chip}>
                <input type="checkbox" className="sr-only" checked={state.levels.includes(l)} onChange={() => onChange({ ...state, levels: toggle(state.levels, l) })} />
                {l}
              </label>
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
