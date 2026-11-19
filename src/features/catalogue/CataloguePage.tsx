import { Link, useSearchParams } from 'react-router';
import { groups, getGroup, topicsInGroup } from '@/lib/content';
import { LevelBadge, StatusBadge } from '@/components/Badge';

/** Phase 1: browse by group. Level/tag filters and search arrive in phase 2. */
export function CataloguePage() {
  const [params, setParams] = useSearchParams();
  const groupFilter = params.get('group');
  const shown = groupFilter && getGroup(groupFilter) ? groups.filter((g) => g.id === groupFilter) : groups;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold tracking-tight">{shown.length === 1 ? shown[0]!.title : 'All topics'}</h1>

      <div className="mt-4">
        <label htmlFor="group-filter" className="text-sm font-medium">
          Group
        </label>
        <select
          id="group-filter"
          value={groupFilter ?? ''}
          onChange={(e) => setParams(e.target.value ? { group: e.target.value } : {})}
          className="ml-2 rounded-md border border-line bg-surface px-2 py-1 text-sm"
        >
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </div>

      {shown.map((g) => (
        <section key={g.id} aria-labelledby={`g-${g.id}`} className="mt-8">
          <h2 id={`g-${g.id}`} className="text-lg font-semibold">
            {g.title}
          </h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {topicsInGroup(g.id).map((t) => (
              <li key={t.id}>
                <Link
                  to={`/topics/${t.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-subtle"
                >
                  <span className={`font-medium ${t.status === 'stub' ? 'text-muted ' : ''}`}>{t.title}</span>
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
      ))}
    </div>
  );
}
