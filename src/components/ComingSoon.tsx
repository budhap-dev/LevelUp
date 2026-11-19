export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 text-muted">This arrives in phase {phase} of the build.</p>
    </div>
  );
}
