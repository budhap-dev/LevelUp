export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-1.5 overflow-hidden rounded-full bg-subtle">
      <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-(--ease-out-expo)" style={{ width: `${pct}%` }} />
    </div>
  );
}
