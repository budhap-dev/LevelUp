import { NavLink, useParams } from 'react-router';
import { groups, getTopicMeta, topicsInGroup } from '@/lib/content';

const MAIN_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/topics', label: 'All topics', end: true },
  { to: '/paths', label: 'Learning paths', end: false },
  { to: '/interview', label: 'Interview mode', end: false },
  { to: '/flashcards', label: 'Flashcards', end: false },
  { to: '/bookmarks', label: 'Bookmarks', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-indigo-500 ${
    isActive
      ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { topicId } = useParams();
  const activeGroup = topicId ? getTopicMeta(topicId)?.group : undefined;

  return (
    <nav aria-label="Main" className="space-y-6 p-4">
      <ul className="space-y-0.5">
        {MAIN_LINKS.map((l) => (
          <li key={l.to}>
            <NavLink to={l.to} end={l.end} className={linkClass} onClick={onNavigate}>
              {l.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div>
        <h2 className="px-3 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Topics</h2>
        <ul className="mt-2 space-y-1">
          {groups.map((g) => (
            <li key={g.id}>
              <details open={g.id === activeGroup} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-200 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
                  {g.title}
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 text-slate-400 transition-transform group-open:rotate-90" fill="currentColor">
                    <path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L11.6 10 7.3 5.7a1 1 0 0 1 0-1.4z" />
                  </svg>
                </summary>
                <ul className="mt-0.5 ml-3 space-y-0.5 border-l border-slate-200 pl-2 dark:border-slate-800">
                  {topicsInGroup(g.id).map((t) => (
                    <li key={t.id}>
                      <NavLink to={`/topics/${t.id}`} className={linkClass} onClick={onNavigate}>
                        <span className={t.status === 'stub' ? 'text-slate-400 dark:text-slate-500' : undefined}>{t.title}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
