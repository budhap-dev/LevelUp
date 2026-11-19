/**
 * Renders HTML compiled at build time from our own Markdown.
 * Safe to inject: the pipeline drops raw HTML from sources, so only Markdown-generated markup reaches here.
 */
export function Prose({ html, className = '' }: { html: string; className?: string }) {
  return (
    <div
      className={`prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-pre:bg-transparent prose-pre:p-4 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
