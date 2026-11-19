import { useEffect, useState } from 'react';
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { Sidebar } from './Sidebar';

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Close the mobile drawer on navigation.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <button
          type="button"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="sidebar"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
        <Link to="/" className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-indigo-500">
          <img src="/favicon.svg" alt="" className="size-7" />
          LevelUp Engineer
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </header>

      <div className="flex">
        {menuOpen && (
          <div className="fixed inset-0 top-14 z-20 bg-slate-900/40 lg:hidden" aria-hidden="true" onClick={() => setMenuOpen(false)} />
        )}
        <aside
          id="sidebar"
          // Off-screen on mobile when closed: keep it out of the tab order and accessibility tree.
          inert={!isDesktop && !menuOpen}
          className={`fixed top-14 bottom-0 z-20 w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-950 lg:sticky lg:h-[calc(100dvh-3.5rem)] lg:translate-x-0 ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar onNavigate={() => setMenuOpen(false)} />
        </aside>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-8 focus:outline-none sm:px-8 lg:px-12">
          <Outlet />
        </main>
      </div>
      <ScrollRestoration />
    </div>
  );
}
