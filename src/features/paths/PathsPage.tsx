import { Link } from 'react-router';
import { paths } from '@/lib/content';
import { pathProgress } from '@/lib/paths';
import { useProgress } from '@/lib/progress/react';
import { ProgressBar } from '@/components/ProgressBar';

export function PathsPage() {
  const progress = useProgress((d) => d.topics);
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight text-fg">Learning paths</h1>
      <p className="mt-2 text-muted">Ordered routes through the topics for a specific career move. Mark topics Learned to move along a path.</p>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {paths.map((p) => {
          const pp = pathProgress(p, progress);
          return (
            <li key={p.id}>
              <Link
                to={`/paths/${p.id}`}
                className="flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition duration-300 ease-(--ease-out-expo) hover:-translate-y-0.5 hover:border-accent"
              >
                <h2 className="text-lg font-semibold text-fg">{p.title}</h2>
                <p className="mt-1 flex-1 text-sm text-muted">{p.description}</p>
                <div className="mt-4">
                  <ProgressBar value={pp.learned} max={pp.required} label={`${p.title}: steps learned`} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {pp.learned}/{pp.required} steps learned
                  {pp.next ? ` · next: ${pp.next.meta.title}` : ' · complete'}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
