import { Link } from 'react-router';
import { groups, topics, topicsInGroup } from '@/lib/content';

export function DashboardPage() {
  const ready = topics.filter((t) => t.status !== 'stub').length;
  const questions = topics.reduce((n, t) => n + t.questionCount, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        {topics.length} topics across {groups.length} groups · {ready} with content · {questions} interview questions
      </p>

      <h2 className="mt-10 text-lg font-semibold">Topic groups</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const inGroup = topicsInGroup(g.id);
          const withContent = inGroup.filter((t) => t.status !== 'stub').length;
          return (
            <li key={g.id}>
              <Link
                to={`/topics?group=${g.id}`}
                className="block h-full rounded-xl border border-slate-200 p-5 transition hover:border-indigo-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-800 dark:hover:border-indigo-700"
              >
                <h3 className="font-semibold">{g.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{g.description}</p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {inGroup.length} topics · {withContent} with content
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
