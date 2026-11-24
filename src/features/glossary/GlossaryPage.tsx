import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { getGroup, getTopicMeta, glossaryCount, groups } from '@/lib/content';
import { loadGlossary } from '@/lib/content/glossary';
import type { GlossaryEntry } from '@/lib/content/schema';
import { Badge } from '@/components/Badge';
import { InlineCode } from '@/components/InlineCode';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const letterOf = (term: string) => {
  const c = term[0]!.toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
};

function Entry({ entry }: { entry: GlossaryEntry }) {
  return (
    <article id={entry.id} className="scroll-mt-24 rounded-xl border border-line bg-surface p-5 sm:scroll-mt-60">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold text-fg">
          <a href={`#${entry.id}`} className="hover:text-accent-ink">
            {entry.term}
          </a>
        </h3>
        {entry.aka.length > 0 && <span className="text-sm text-muted">also: {entry.aka.join(', ')}</span>}
        <span className="ml-auto">
          <Badge>{getGroup(entry.group)?.shortTitle ?? entry.group}</Badge>
        </span>
      </header>
      <p className="mt-2 text-fg-soft">
        <InlineCode text={entry.definition} />
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">Key details</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg-soft marker:text-muted">
            {entry.details.map((d) => (
              <li key={d}>
                <InlineCode text={d} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">Use cases</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg-soft marker:text-muted">
            {entry.useCases.map((u) => (
              <li key={u}>
                <InlineCode text={u} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      {entry.related.length > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Learn more:</span>
          {entry.related.map((id) => (
            <Link key={id} to={`/topics/${id}`} className="rounded-md bg-accent-soft px-2 py-0.5 text-accent-ink hover:underline">
              {getTopicMeta(id)?.title ?? id}
            </Link>
          ))}
        </p>
      )}
    </article>
  );
}

export function GlossaryPage() {
  const [entries, setEntries] = useState<GlossaryEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const { hash } = useLocation();

  useEffect(() => {
    let live = true;
    void loadGlossary().then((e) => live && setEntries(e));
    return () => {
      live = false;
    };
  }, []);

  // Deep links (/glossary#term) from search: scroll once the entries have rendered, and flash the target.
  useEffect(() => {
    if (!entries || !hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    el.classList.remove('flash-target');
    void el.offsetWidth; // restart the animation
    el.classList.add('flash-target');
  }, [entries, hash]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (!group || e.group === group) &&
        (!q || [e.term, ...e.aka, e.definition, ...e.details, ...e.useCases].some((s) => s.toLowerCase().includes(q))),
    );
  }, [entries, query, group]);

  const byLetter = useMemo(() => {
    const map = new Map<string, GlossaryEntry[]>();
    for (const e of filtered) map.set(letterOf(e.term), [...(map.get(letterOf(e.term)) ?? []), e]);
    return map;
  }, [filtered]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold tracking-tight text-fg">Glossary</h1>
      <p className="mt-2 max-w-3xl text-muted">
        {glossaryCount} key terms across every module — what each one means, the details that matter in practice and in interviews, and where you'd use it.
      </p>

      <div className="z-10 -mx-4 mt-6 sm:sticky sm:top-16 border-b border-line bg-canvas px-4 py-3 sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <div className="flex flex-wrap gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Filter terms</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter terms…"
              className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <label>
            <span className="sr-only">Module</span>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
            >
              <option value="">All modules</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav aria-label="Jump to letter" className="mt-2 flex flex-wrap gap-0.5">
          {LETTERS.map((l) =>
            byLetter.has(l) ? (
              <a key={l} href={`#letter-${l}`} className="flex size-7 items-center justify-center rounded-md text-sm font-medium text-fg-soft hover:bg-subtle hover:text-fg">
                {l}
              </a>
            ) : (
              <span key={l} aria-hidden="true" className="flex size-7 items-center justify-center text-sm text-line">
                {l}
              </span>
            ),
          )}
        </nav>
      </div>

      {!entries ? (
        <p className="mt-8 text-muted">Loading glossary…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-muted">No terms match.</p>
      ) : (
        <div className="mt-6 space-y-10">
          {[...byLetter.entries()].map(([letter, list]) => (
            <section key={letter} aria-labelledby={`letter-${letter}`}>
              <h2 id={`letter-${letter}`} className="scroll-mt-24 text-2xl font-semibold text-fg sm:scroll-mt-56">
                {letter}
              </h2>
              <div className="mt-3 space-y-4">
                {list.map((e) => (
                  <Entry key={e.id} entry={e} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
