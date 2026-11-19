import { useEffect, useRef } from 'react';
import { useTheme } from '@/lib/theme';

/**
 * Renders HTML compiled at build time from our own Markdown, and hydrates Mermaid diagrams in it.
 * Safe to inject: the pipeline drops raw HTML from sources, so only Markdown-generated markup reaches here.
 */
export function Prose({ html, className = '' }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { theme, mode } = useTheme();

  useEffect(() => {
    const diagrams = ref.current?.querySelectorAll<HTMLElement>('.mermaid-diagram');
    if (!diagrams?.length || !('IntersectionObserver' in window)) return;

    // Render each diagram as it approaches the viewport (also re-renders after a theme change).
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          void import('@/lib/mermaid').then(({ renderDiagram }) => renderDiagram(entry.target as HTMLElement, theme, mode === 'dark'));
        }
      },
      { rootMargin: '200px 0px' },
    );
    diagrams.forEach((d) => observer.observe(d));
    return () => observer.disconnect();
  }, [html, theme, mode]);

  return (
    <div
      ref={ref}
      className={`prose max-w-none prose-headings:scroll-mt-24 prose-pre:p-4 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
