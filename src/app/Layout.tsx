import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import { Link, Outlet, ScrollRestoration, useLocation, useNavigation } from 'react-router';
import { Logo } from '@/components/Logo';
import { ThemePicker } from '@/components/ThemePicker';
import { CommandPalette } from '@/features/search/CommandPalette';
import { SearchButton } from '@/features/search/SearchButton';
import { ThemeProvider } from '@/lib/theme';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { Sidebar } from './Sidebar';

/** Three bars that morph into an X. */
function HamburgerIcon({ open }: { open: boolean }) {
  const bar = 'absolute left-0 h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-(--ease-drawer)';
  return (
    <span aria-hidden="true" className="relative block h-3.5 w-5">
      <span className={`${bar} ${open ? 'top-1.5 rotate-45' : 'top-0'}`} />
      <span className={`${bar} top-1.5 ${open ? 'scale-x-0 opacity-0' : ''}`} />
      <span className={`${bar} ${open ? 'top-1.5 -rotate-45' : 'top-3'}`} />
    </span>
  );
}

/** Thin accent bar while a route (e.g. a topic chunk) is loading. */
function NavigationProgress() {
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden transition-opacity duration-300 ${busy ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="h-full w-full origin-left animate-progress bg-accent" />
    </div>
  );
}

export function Layout() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const drawerRef = useRef<HTMLElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerOpen = menuOpen && !isDesktop;
  const [searchOpen, setSearchOpen] = useState(false);

  // Global shortcuts: Ctrl/Cmd+K toggles search; "/" opens it when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openMenu = () => {
    setOpenCount((c) => c + 1);
    setMenuOpen(true);
  };
  const closeMenu = useCallback((returnFocus = false) => {
    setMenuOpen(false);
    if (returnFocus) menuButtonRef.current?.focus();
  }, []);

  // Close on navigation and when resizing up to desktop.
  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (isDesktop) setMenuOpen(false);
  }, [isDesktop]);

  // While the drawer is open: lock page scroll, close on Escape, move focus into the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu(true);
    window.addEventListener('keydown', onKey);
    drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen, closeMenu]);

  // Swipe left on the drawer to close it; the drawer follows the finger.
  const drag = useRef<{ x: number; y: number; dx: number; axis: 'x' | 'y' | null } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    if (!drawerOpen) return;
    const t = e.touches[0]!;
    drag.current = { x: t.clientX, y: t.clientY, dx: 0, axis: null };
  };
  const onTouchMove = (e: TouchEvent) => {
    const d = drag.current;
    const drawer = drawerRef.current;
    if (!d || !drawer) return;
    const t = e.touches[0]!;
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (!d.axis && Math.hypot(dx, dy) > 8) d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (d.axis !== 'x') return;
    d.dx = Math.min(0, dx);
    drawer.style.transition = 'none';
    drawer.style.transform = `translateX(${d.dx}px)`;
    if (scrimRef.current) scrimRef.current.style.opacity = String(0.5 * (1 + d.dx / drawer.offsetWidth));
  };
  const onTouchEnd = () => {
    const d = drag.current;
    const drawer = drawerRef.current;
    drag.current = null;
    if (!d || !drawer) return;
    drawer.style.transition = '';
    drawer.style.transform = '';
    if (scrimRef.current) scrimRef.current.style.opacity = '';
    if (d.axis === 'x' && d.dx < -drawer.offsetWidth * 0.3) closeMenu();
  };

  return (
    <div className="min-h-dvh bg-canvas text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-line bg-surface px-3 sm:px-5">
        <button
          ref={menuButtonRef}
          type="button"
          className="flex size-10 items-center justify-center rounded-lg text-fg-soft transition-colors hover:bg-subtle lg:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={drawerOpen}
          aria-controls="sidebar"
          onClick={() => (menuOpen ? closeMenu() : openMenu())}
        >
          <HamburgerIcon open={drawerOpen} />
        </button>
        <Link to="/" className="logo-link rounded-lg p-1" aria-label="LevelUp Engineer — home">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <SearchButton onClick={() => setSearchOpen(true)} />
          <ThemePicker />
        </div>
        <NavigationProgress />
      </header>

      <div className="flex">
        {/* Scrim: solid colour faded in behind the drawer (mobile only). */}
        <div
          ref={scrimRef}
          aria-hidden="true"
          onClick={() => closeMenu()}
          className={`fixed inset-0 top-16 z-30 bg-scrim transition-opacity duration-300 lg:hidden ${
            drawerOpen ? 'opacity-50' : 'pointer-events-none opacity-0'
          }`}
        />
        <aside
          id="sidebar"
          ref={drawerRef}
          aria-label="Site navigation"
          // Off-screen on mobile when closed: keep it out of the tab order and accessibility tree.
          inert={!isDesktop && !menuOpen}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          className={`fixed top-16 bottom-0 left-0 z-30 w-[min(20rem,85vw)] shrink-0 overflow-y-auto overscroll-contain border-r border-line bg-surface transition-transform duration-[400ms] ease-(--ease-drawer) lg:sticky lg:h-[calc(100dvh-4rem)] lg:w-72 lg:translate-x-0 lg:transition-none ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar animateKey={isDesktop ? 0 : openCount} />
        </aside>

        <main id="main" tabIndex={-1} inert={drawerOpen} className="min-w-0 flex-1 px-4 pt-6 pb-16 focus:outline-none sm:px-8 sm:pt-8 lg:px-12">
          {/* Re-keyed per route so each page animates in. */}
          <div key={location.pathname} className="animate-page-in">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ScrollRestoration />
    </div>
  );
}
