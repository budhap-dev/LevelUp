export type Severity = 'error' | 'warning';

export interface Diagnostic {
  severity: Severity;
  file: string;
  message: string;
}

/** Collects problems so one build reports all of them, not just the first. */
export class Diagnostics {
  readonly items: Diagnostic[] = [];

  error(file: string, message: string) {
    this.items.push({ severity: 'error', file, message });
  }

  warn(file: string, message: string) {
    this.items.push({ severity: 'warning', file, message });
  }

  get errors() {
    return this.items.filter((d) => d.severity === 'error');
  }

  get warnings() {
    return this.items.filter((d) => d.severity === 'warning');
  }

  format(items: Diagnostic[] = this.items): string {
    const byFile = new Map<string, Diagnostic[]>();
    for (const d of items) byFile.set(d.file, [...(byFile.get(d.file) ?? []), d]);
    return [...byFile.entries()]
      .map(([file, ds]) => [file, ...ds.map((d) => `  ${d.severity === 'error' ? '✖' : '⚠'} ${d.message}`)].join('\n'))
      .join('\n');
  }
}
