import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, useParams } from 'react-router';
import { groups, getTopicMeta, topicsInGroup } from '@/lib/content';
import type { Group } from '@/lib/content/schema';
import { useProgress } from '@/lib/progress/react';
import { STATE_LABEL, StatusGlyph, StatusLabel } from '@/components/TopicStatusIcon';
import { Icon, type IconName } from '@/components/Icon';
import { useDueCounts } from '@/lib/srs/useDueCounts';

type NavItem = { to: string; label: string; icon: IconName; end?: boolean };

const OVERVIEW: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/topics', label: 'All topics', icon: 'book', end: true },
  { to: '/paths', label: 'Learning paths', icon: 'route' },
];
const PRACTICE: NavItem[] = [
  { to: '/interview', label: 'Interview mode', icon: 'chat' },
  { to: '/flashcards', label: 'Flashcards', icon: 'layers' },
];
const LIBRARY: NavItem[] = [{ to: '/bookmarks', label: 'Bookmarks', icon: 'bookmark' }];

const GROUP_ICON: Record<string, IconName> = {
  'languages-frontend': 'code',
  'backend-apis': 'server',
  data: 'database',
  'cloud-devops': 'cloud',
  'architecture-design': 'network',
  'quality-security': 'shield',
  ai: 'sparkles',
  delivery: 'rocket',
  'product-business': 'target',
  'leadership-people': 'users',
};

/** Row look shared by links and group toggles: soft fill on hover, accent fill when active, slight press. */
const rowClass = (active: boolean) =>
  `group/link relative flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm transition-[background-color,color,scale] duration-200 ease-(--ease-out-expo) active:scale-[0.98] ${
    active ? 'bg-accent-soft font-medium text-accent-ink' : 'text-fg-soft hover:bg-subtle hover:text-fg'
  }`;

/** Leading icon: nudges on hover, takes the accent colour when its row is active. */
function RowIcon({ name, active }: { name: IconName; active: boolean }) {
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center transition-[color,translate,scale] duration-300 ease-(--ease-out-expo) group-hover/link:scale-110 ${
        active ? 'text-accent-ink' : 'text-muted group-hover/link:text-fg-soft'
      }`}
    >
      <Icon name={name} className="size-4.5" />
    </span>
  );
}

/** Accent bar that grows in from its centre on the active row. */
function ActiveBar({ active, className = 'top-1.5 bottom-1.5 left-0 w-1' }: { active: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute rounded-full bg-accent transition-[scale,opacity] duration-300 ease-(--ease-out-expo) ${className} ${
        active ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'
      }`}
    />
  );
}

/** Staggered slide-in while the mobile drawer opens (index orders items down the whole menu). */
function makeStagger(animate: boolean) {
  let i = 0;
  return (): { className?: string; style?: CSSProperties } =>
    animate ? { className: 'animate-slide-in', style: { animationDelay: `${60 + i++ * 25}ms` } } : {};
}
type Anim = ReturnType<ReturnType<typeof makeStagger>>;

function SectionHeading({ children, anim: s, action }: { children: ReactNode; anim: Anim; action?: ReactNode }) {
  return (
    <div className={`mb-1 flex h-7 items-center justify-between pr-1 pl-2.5 ${s.className ?? ''}`} style={s.style}>
      <h2 className="text-[0.6875rem] font-semibold tracking-[0.08em] text-muted uppercase">{children}</h2>
      {action}
    </div>
  );
}

function NavRow({ item, anim: s, badge, trailing }: { item: NavItem; anim: Anim; badge?: number; trailing?: ReactNode }) {
  return (
    <li className={`relative ${s.className ?? ''}`} style={s.style}>
      <NavLink to={item.to} end={item.end} className={({ isActive }) => rowClass(isActive)}>
        {({ isActive }) => (
          <>
            <ActiveBar active={isActive} />
            <RowIcon name={item.icon} active={isActive} />
            <span className="flex-1 truncate">{item.label}</span>
            {!!badge && (
              <>
                {/* Real spaces so assistive tech reads "Interview mode, 3 due", not "Interview mode3due". */}{' '}
                <span key={badge} className="animate-pop-in rounded-full bg-accent px-1.5 py-px text-xs font-semibold text-on-accent tabular-nums">
                  {badge} <span className="sr-only">due</span>
                </span>
              </>
            )}
            {trailing && <span aria-hidden="true" className="w-6 shrink-0" />}
          </>
        )}
      </NavLink>
      {trailing}
    </li>
  );
}

function GroupSection({ group, open, onToggle }: { group: Group; open: boolean; onToggle: () => void }) {
  const panelId = useId();
  const progress = useProgress((d) => d.topics);
  const { topicId } = useParams();
  const topics = topicsInGroup(group.id);
  const learned = topics.filter((t) => progress[t.id]?.state === 'learned').length;
  const containsActive = topics.some((t) => t.id === topicId);

  return (
    <>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle} className={rowClass(false)}>
        <RowIcon name={GROUP_ICON[group.id] ?? 'folder'} active={containsActive} />
        <span className={`flex-1 truncate ${containsActive ? 'font-medium text-fg' : ''}`}>{group.title}</span>
        <span aria-hidden="true" className="text-xs text-muted tabular-nums">
          {learned > 0 ? `${learned}/${topics.length}` : topics.length}
        </span>
        <span aria-hidden="true" className="flex size-4 items-center justify-center">
          <Icon
            name="chevron"
            className={`size-3.5 text-muted transition-transform duration-300 ease-(--ease-out-expo) ${open ? 'rotate-90' : ''}`}
          />
        </span>
      </button>
      {/* grid-rows 0fr → 1fr animates the height without measuring it. */}
      <div
        id={panelId}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-(--ease-out-expo) ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          {/* The guide line sits under the group icon; topics hang off it. */}
          <ul data-open={open} className="nav-tree mt-0.5 mb-1.5 ml-[calc(1.25rem-0.5px)] space-y-px border-l border-line">
            {topics.map((t, i) => {
              const state = progress[t.id]?.state;
              return (
                <li key={t.id} className="pl-2" style={{ '--i': i } as CSSProperties}>
                  <NavLink
                    to={`/topics/${t.id}`}
                    className={({ isActive }) =>
                      `group/link relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[0.8125rem] transition-colors duration-200 ${
                        isActive ? 'bg-accent-soft font-medium text-accent-ink' : 'text-fg-soft hover:bg-subtle hover:text-fg'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Over the guide line: accent when active, a faint hint on hover. */}
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-1 -left-[0.6rem] w-0.5 rounded-full transition-[scale,opacity,background-color] duration-300 ease-(--ease-out-expo) ${
                            isActive ? 'scale-y-100 bg-accent opacity-100' : 'scale-y-0 bg-muted opacity-0 group-hover/link:scale-y-100 group-hover/link:opacity-60'
                          }`}
                        />
                        <span title={STATE_LABEL[state ?? 'not-started']} className="flex shrink-0">
                          <StatusGlyph state={state} placeholder className="size-3.5" />
                        </span>
                        <span className={`flex-1 truncate ${t.status === 'stub' && !isActive ? 'text-muted' : ''}`}>
                          {t.title}
                          <StatusLabel state={state} />
                        </span>
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}

/**
 * @param animateKey changes each time the mobile drawer opens, replaying the stagger. 0 = no animation (desktop).
 */
export function Sidebar({ animateKey }: { animateKey: number }) {
  const { topicId } = useParams();
  const activeGroup = topicId ? getTopicMeta(topicId)?.group : undefined;
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(activeGroup ? [activeGroup] : []));
  const stagger = makeStagger(animateKey > 0);
  const due = useDueCounts();

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

  const newNote = (
    <Link
      to="/notes?new=1"
      aria-label="New note"
      title="New note"
      className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-[color,background-color,rotate] duration-300 ease-(--ease-out-expo) hover:rotate-90 hover:bg-surface hover:text-fg"
    >
      <Icon name="plus" className="size-4" />
    </Link>
  );

  return (
    // Re-keyed per drawer opening so the stagger replays.
    <nav key={animateKey} aria-label="Main" className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 px-3 pt-4 pb-6">
        <ul className="space-y-0.5">
          {OVERVIEW.map((item) => (
            <NavRow key={item.to} item={item} anim={stagger()} />
          ))}
        </ul>

        <section>
          <SectionHeading anim={stagger()}>Practice</SectionHeading>
          <ul className="space-y-0.5">
            <NavRow item={PRACTICE[0]!} anim={stagger()} badge={due.questions} />
            <NavRow item={PRACTICE[1]!} anim={stagger()} badge={due.flashcards} />
          </ul>
        </section>

        <section>
          <SectionHeading anim={stagger()}>Library</SectionHeading>
          <ul className="space-y-0.5">
            {LIBRARY.map((item) => (
              <NavRow key={item.to} item={item} anim={stagger()} />
            ))}
            {/* Notes titles live on the Notes page, not here. */}
            <NavRow item={{ to: '/notes', label: 'Notes', icon: 'note' }} anim={stagger()} trailing={newNote} />
          </ul>
        </section>

        <section>
          <SectionHeading
            anim={stagger()}
            action={
              <button
                type="button"
                onClick={() => setOpenGroups(new Set())}
                aria-label="Collapse all topic groups"
                title="Collapse all"
                tabIndex={openGroups.size ? 0 : -1}
                aria-hidden={!openGroups.size}
                className={`flex size-6 items-center justify-center rounded-md text-muted transition-[opacity,color,background-color] duration-200 hover:bg-subtle hover:text-fg ${
                  openGroups.size ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              >
                <Icon name="collapse" className="size-3.5" />
              </button>
            }
          >
            Topics
          </SectionHeading>
          <ul className="space-y-0.5">
            {groups.map((g) => {
              const s = stagger();
              return (
                <li key={g.id} className={s.className} style={s.style}>
                  <GroupSection group={g} open={openGroups.has(g.id)} onToggle={() => toggle(g.id)} />
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Settings stays in reach at the bottom while the menu scrolls. */}
      <div className="sticky bottom-0 border-t border-line bg-surface px-3 py-2">
        <ul>
          <NavRow item={{ to: '/settings', label: 'Settings', icon: 'settings' }} anim={stagger()} />
        </ul>
      </div>
    </nav>
  );
}
