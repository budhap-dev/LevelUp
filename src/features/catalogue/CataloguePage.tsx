import { Link, useSearchParams } from 'react-router';
import { getGroup, groups, topics } from '@/lib/content';
import { LEVELS, type Level } from '@/lib/content/constants';
import type { TopicMeta } from '@/lib/content/schema';
import { LevelBadge, StatusBadge } from '@/components/Badge';

/** Filters live in the URL (?group=&level=&tag=&content=1) so views can be bookmarked and shared. */
interface Filters {
  group: string | null;
  level: Level | null;
  tag: string | null;
  contentOnly: boolean;
}

const ALL_TAGS: { tag: string; count: number }[] = Object.entries(
  topics.reduce<Record<string, number>>((acc, t) => {
    for (const tag of t.tags) acc[tag] = (acc[tag] ?? 0) + 1;
    return acc;
  }, {}),
)
  .map(([tag, count]) => ({ tag, count }))
  .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

function readFilters(params: URLSearchParams): Filters {
  const group = params.get('group');
  const level = params.get('level');
  const tag = params.get('tag');
  return {
    group: group && getGroup(group) ? group : null,
    level: LEVELS.includes(level as Level) ? (level as Level) : null,
    tag: tag && ALL_TAGS.some((t) => t.tag === tag) ? tag : null,
    contentOnly: params.get('content') === '1',
  };
}

const matches = (t: TopicMeta, f: Filters) =>
  (!f.group || t.group === f.group) &&
  (!f.level || t.level === f.level) &&
  (!f.tag || t.tags.includes(f.tag)) &&
  (!f.contentOnly || t.status !== 'stub');

const selectClass =
  'h-10 rounded-lg border border-line bg-surface px-3 text-sm text-fg transition-colors hover:border-accent focus-visible:border-accent';

export function CataloguePage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const active = !!(filters.group || filters.level || filters.tag || filters.contentOnly);

  const update = (patch: Partial<Record<'group' | 'level' | 'tag' | 'content', string | null>>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const shown = topics.filter((t) => matches(t, filters));
  const byGroup = groups.map((g) => ({ group: g, items: shown.filter((t) => t.group === g.id) })).filter((g) => g.items.length);
  const heading = filters.group ? getGroup(filters.group)!.title : 'All topics';

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold tracking-tight text-fg">{heading}</h1>

      <div role="group" aria-label="Filters" className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-3">
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Level</legend>
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {[null, ...LEVELS].map((level) => (
              <label
                key={level ?? 'all'}
                className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-fg-soft transition-colors duration-200 hover:text-fg has-checked:bg-accent has-checked:text-on-accent has-focus-visible:outline-2 has-focus-visible:outline-accent"
              >
                <input type="radio" name="level" className="sr-only" checked={filters.level === level} onChange={() => update({ level })} />
                {level ?? 'All'}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col">
          <span className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Group</span>
          <select value={filters.group ?? ''} onChange={(e) => update({ group: e.target.value || null })} className={selectClass}>
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Tag</span>
          <select value={filters.tag ?? ''} onChange={(e) => update({ tag: e.target.value || null })} className={`${selectClass} max-w-[14rem]`}>
            <option value="">All tags</option>
            {ALL_TAGS.map(({ tag, count }) => (
              <option key={tag} value={tag}>
                #{tag} ({count})
              </option>
            ))}
          </select>
        </label>

        <label className="flex h-10 cursor-pointer items-center gap-2.5 text-sm text-fg-soft">
          <input
            type="checkbox"
            role="switch"
            checked={filters.contentOnly}
            onChange={(e) => update({ content: e.target.checked ? '1' : null })}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-6 w-10 rounded-full border border-line bg-subtle transition-colors duration-200 peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-4.5 after:rounded-full after:bg-surface after:transition-transform after:duration-300 after:ease-(--ease-out-expo) peer-checked:after:translate-x-4"
          />
          With content only
        </label>

        {active && (
          <button
            type="button"
            onClick={() => setParams({}, { replace: true, preventScrollReset: true })}
            className="h-10 rounded-lg px-3 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-soft"
          >
            Clear filters
          </button>
        )}
      </div>

      <p className="mt-4 text-sm text-muted" role="status" aria-live="polite">
        {shown.length} of {topics.length} topics
        {filters.tag && (
          <>
            {' '}tagged <span className="font-medium text-fg">#{filters.tag}</span>
          </>
        )}
      </p>

      {byGroup.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line p-10 text-center text-muted">No topics match these filters.</div>
      ) : (
        byGroup.map(({ group, items }) => (
          <section key={group.id} aria-labelledby={`g-${group.id}`} className="mt-8 animate-page-in">
            <h2 id={`g-${group.id}`} className="text-lg font-semibold text-fg">
              {group.title}
            </h2>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {items.map((t) => (
                <li key={t.id}>
                  <Link to={`/topics/${t.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-subtle">
                    <span className={`font-medium ${t.status === 'stub' ? 'text-muted' : 'text-fg'}`}>{t.title}</span>
                    <LevelBadge level={t.level} />
                    <StatusBadge status={t.status} />
                    <span className="ml-auto text-xs text-muted">
                      {t.estimatedMinutes} min{t.questionCount ? ` · ${t.questionCount} questions` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
