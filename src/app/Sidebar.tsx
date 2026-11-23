import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useParams } from 'react-router';
import { groups, getTopicMeta, topicsInGroup } from '@/lib/content';
import type { Group } from '@/lib/content/schema';
import { useProgress } from '@/lib/progress/react';
import { TopicStatusIcon } from '@/components/TopicStatusIcon';
import { useDueCounts } from '@/lib/srs/useDueCounts';
import { notesStore, useNotesState } from '@/lib/notes/store';

const RECENT_NOTES = 5;

const MAIN_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/topics', label: 'All topics', end: true },
  { to: '/paths', label: 'Learning paths', end: false },
  { to: '/interview', label: 'Interview mode', end: false },
  { to: '/flashcards', label: 'Flashcards', end: false },
  { to: '/bookmarks', label: 'Bookmarks', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

/** Active link: accent bar slides in from the left, background fades in. */
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `group/link relative flex items-center rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${
    isActive ? 'bg-accent-soft font-medium text-accent-ink' : 'text-fg-soft hover:bg-subtle hover:text-fg'
  }`;

function ActiveBar({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute top-1.5 bottom-1.5 left-0 w-1 rounded-full bg-accent transition-all duration-300 ease-(--ease-out-expo) ${
        active ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'
      }`}
    />
  );
}

/** Staggered slide-in when the mobile drawer opens. */
function Item({ index, animate, children }: { index: number; animate: boolean; children: ReactNode }) {
  return (
    <li className={animate ? 'animate-slide-in' : undefined} style={animate ? { animationDelay: `${60 + index * 30}ms` } : undefined}>
      {children}
    </li>
  );
}

function GroupSection({ group, open, onToggle }: { group: Group; open: boolean; onToggle: () => void }) {
  const panelId = useId();
  const progress = useProgress((d) => d.topics);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-fg transition-colors hover:bg-subtle"
      >
        {group.title}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`size-4 text-muted transition-transform duration-300 ease-(--ease-out-expo) ${open ? 'rotate-90' : ''}`}
          fill="currentColor"
        >
          <path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L11.6 10 7.3 5.7a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>
      {/* grid-rows 0fr → 1fr animates the height without measuring it. */}
      <div
        id={panelId}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-(--ease-out-expo) ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <ul className="mt-0.5 mb-1 ml-3 space-y-0.5 border-l border-line pl-2">
            {topicsInGroup(group.id).map((t) => (
              <li key={t.id}>
                <NavLink to={`/topics/${t.id}`} className={linkClass}>
                  {({ isActive }) => (
                    <>
                      <ActiveBar active={isActive} />
                      <span className={`flex-1 ${t.status === 'stub' && !isActive ? 'text-muted' : ''}`}>{t.title}</span>
                      <TopicStatusIcon state={progress[t.id]?.state} className="size-3.5" />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

/** The sidebar's Notes menu: a new-note button, recent notes, and a link to all of them. */
function NotesSection({ animate, index }: { animate: boolean; index: number }) {
  const { status, notes } = useNotesState();
  const location = useLocation();
  const onNotes = location.pathname === '/notes';
  const current = onNotes ? new URLSearchParams(location.search).get('note') : null;

  useEffect(() => {
    if (notesStore.get().status === 'idle') void notesStore.refresh();
  }, []);

  const recent = notes.slice(0, RECENT_NOTES);
  return (
    <div>
      <div className="flex items-center justify-between pr-1 pl-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Notes</h2>
        <Link
          to="/notes?new=1"
          aria-label="New note"
          title="New note"
          className="flex size-7 items-center justify-center rounded-md text-fg-soft transition-colors hover:bg-subtle hover:text-fg"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </div>
      <ul className="mt-1 space-y-0.5" aria-label="Recent notes">
        {status === 'locked' && (
          <Item index={index} animate={animate}>
            <Link to="/notes" className={linkClass({ isActive: false })}>
              <span className="flex-1">Unlock notes</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" />
              </svg>
            </Link>
          </Item>
        )}
        {recent.map((n, i) => {
          const active = n.id === current;
          return (
            <Item key={n.id} index={index + i} animate={animate}>
              <Link to={`/notes?note=${n.id}`} aria-current={active ? 'page' : undefined} className={linkClass({ isActive: active })}>
                <ActiveBar active={active} />
                <span className={`flex-1 truncate ${n.title ? '' : 'italic'}`}>{n.title || 'Untitled'}</span>
              </Link>
            </Item>
          );
        })}
        {status !== 'locked' && (
          <Item index={index + recent.length} animate={animate}>
            <NavLink to="/notes" end className={() => linkClass({ isActive: onNotes && !current })}>
              <ActiveBar active={onNotes && !current} />
              <span className="flex-1">{notes.length > RECENT_NOTES ? `All notes (${notes.length})` : 'All notes'}</span>
            </NavLink>
          </Item>
        )}
      </ul>
    </div>
  );
}

/**
 * @param animateKey changes each time the mobile drawer opens, replaying the stagger. 0 = no animation (desktop).
 */
export function Sidebar({ animateKey }: { animateKey: number }) {
  const { topicId } = useParams();
  const activeGroup = topicId ? getTopicMeta(topicId)?.group : undefined;
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(activeGroup ? [activeGroup] : []));
  const animate = animateKey > 0;
  const due = useDueCounts();
  const dueFor: Record<string, number> = { '/interview': due.questions, '/flashcards': due.flashcards };

  // Reveal the group of the topic being viewed.
  useEffect(() => {
    if (activeGroup) setOpenGroups((s) => (s.has(activeGroup) ? s : new Set(s).add(activeGroup)));
  }, [activeGroup]);

  const toggle = (id: string) =>
    setOpenGroups((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <nav aria-label="Main" className="space-y-6 p-4">
      <ul className="space-y-0.5" key={`main-${animateKey}`}>
        {MAIN_LINKS.map((l, i) => (
          <Item key={l.to} index={i} animate={animate}>
            <NavLink to={l.to} end={l.end} className={linkClass}>
              {({ isActive }) => (
                <>
                  <ActiveBar active={isActive} />
                  <span className="flex-1">{l.label}</span>
                  {!!dueFor[l.to] && (
                    <>
                      {/* Real spaces so assistive tech reads "Interview mode, 3 due", not "Interview mode3due". */}{' '}
                      <span className="rounded-full bg-accent px-1.5 py-px text-xs font-semibold text-on-accent tabular-nums">
                        {dueFor[l.to]} <span className="sr-only">due</span>
                      </span>
                    </>
                  )}
                </>
              )}
            </NavLink>
          </Item>
        ))}
      </ul>

      <NotesSection key={`notes-${animateKey}`} animate={animate} index={MAIN_LINKS.length} />

      <div>
        <h2 className="px-3 text-xs font-semibold tracking-wide text-muted uppercase">Topics</h2>
        <ul className="mt-2 space-y-0.5" key={`groups-${animateKey}`}>
          {groups.map((g, i) => (
            <Item key={g.id} index={MAIN_LINKS.length + i} animate={animate}>
              <GroupSection group={g} open={openGroups.has(g.id)} onToggle={() => toggle(g.id)} />
            </Item>
          ))}
        </ul>
      </div>
    </nav>
  );
}
