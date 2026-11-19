import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '@/lib/theme';
import { THEMES, type ThemePreference } from '@/lib/themes';

/** Swatch that previews a theme by scoping its CSS variables to itself. */
function Swatch({ theme }: { theme: string }) {
  return (
    <span data-theme={theme} aria-hidden="true" className="flex size-7 shrink-0 overflow-hidden rounded-md border border-line bg-canvas">
      <span className="w-1/2 bg-surface" />
      <span className="flex w-1/2 items-end bg-canvas p-0.5">
        <span className="h-2 w-full rounded-sm bg-accent" />
      </span>
    </span>
  );
}

function SystemSwatch() {
  return (
    <span aria-hidden="true" className="flex size-7 shrink-0 overflow-hidden rounded-md border border-line">
      <span data-theme="light" className="w-1/2 bg-canvas" />
      <span data-theme="dark" className="w-1/2 bg-canvas" />
    </span>
  );
}

export function ThemePicker() {
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    // Focus the selected option when the panel opens.
    panelRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const choose = (value: ThemePreference, el: HTMLElement) => {
    const rect = (buttonRef.current ?? el).getBoundingClientRect();
    setPreference(value, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  const options: { value: ThemePreference; label: string; swatch: ReactNode }[] = [
    { value: 'system', label: 'System', swatch: <SystemSwatch /> },
    ...THEMES.map((t) => ({ value: t.id as ThemePreference, label: t.label, swatch: <Swatch theme={t.id} /> })),
  ];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Choose colour theme"
        onClick={() => setOpen((o) => !o)}
        className="flex size-10 items-center justify-center rounded-lg text-fg-soft transition-colors hover:bg-subtle"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 21 9.8C21 6 17 3 12 3z" />
          <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
          <circle cx="10.5" cy="7" r="1" fill="currentColor" />
          <circle cx="15" cy="7.5" r="1" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="absolute right-0 z-50 mt-2 w-60 max-w-[calc(100vw-2rem)] origin-top-right animate-pop-in rounded-xl border border-line bg-surface p-2"
        >
          <fieldset>
            <legend className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-muted uppercase">Theme</legend>
            {options.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-fg-soft transition-colors hover:bg-subtle has-checked:bg-accent-soft has-checked:font-medium has-checked:text-accent-ink has-focus-visible:outline-2 has-focus-visible:outline-accent"
              >
                <input
                  type="radio"
                  name="theme"
                  value={o.value}
                  checked={preference === o.value}
                  onChange={(e) => choose(o.value, e.currentTarget)}
                  className="sr-only"
                />
                {o.swatch}
                <span className="flex-1">{o.label}</span>
                {preference === o.value && (
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
                    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
                  </svg>
                )}
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </div>
  );
}
