/**
 * Markdown parsing and HTML rendering for content files.
 *
 * Parsing and rendering are split so the pipeline can walk the mdast tree
 * (to find sections, questions and cheat-sheet bullets) and then render
 * just the slices it needs.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import type { Root as MdRoot, RootContent } from 'mdast';
import type { Root as HastRoot, Element, ElementContent } from 'hast';

const SHIKI_LANGS = [
  'typescript', 'tsx', 'javascript', 'jsx', 'json', 'yaml', 'bash', 'shellscript', 'sql',
  'python', 'csharp', 'java', 'go', 'kotlin', 'swift', 'hcl', 'terraform', 'bicep',
  'dockerfile', 'http', 'graphql', 'proto', 'diff', 'markdown', 'xml',
] as const;

const parser = unified().use(remarkParse).use(remarkGfm);

export function parseMarkdown(markdown: string): MdRoot {
  return parser.parse(markdown);
}

/** Visit every element in a hast tree, depth-first. */
function visitElements(node: HastRoot | Element, fn: (el: Element, parent: HastRoot | Element, index: number) => void) {
  node.children.forEach((child, index) => {
    if (child.type === 'element') {
      fn(child, node, index);
      visitElements(child, fn);
    }
  });
}

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

/**
 * Replace ```mermaid code blocks with a placeholder the client hydrates:
 *   <div class="mermaid-diagram" data-mermaid>graph TD ...</div>
 * Runs before Shiki so the block is not syntax-highlighted.
 */
function rehypeMermaidPlaceholder() {
  return (tree: HastRoot) => {
    visitElements(tree, (el, parent, index) => {
      if (el.tagName !== 'pre') return;
      const code = el.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
      const classes = code?.properties?.className;
      if (!code || !Array.isArray(classes) || !classes.includes('language-mermaid')) return;
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['mermaid-diagram'], dataMermaid: '' },
        children: [{ type: 'text', value: textOf(code).trimEnd() }],
      };
    });
  };
}

/** Open external links in a new tab, safely. */
function rehypeExternalLinks() {
  return (tree: HastRoot) => {
    visitElements(tree, (el) => {
      const href = el.properties?.href;
      if (el.tagName === 'a' && typeof href === 'string' && /^https?:\/\//.test(href)) {
        el.properties.target = '_blank';
        el.properties.rel = ['noopener', 'noreferrer'];
      }
    });
  };
}

/** Wrap tables so they can scroll horizontally on narrow screens. */
function rehypeTableWrapper() {
  return (tree: HastRoot) => {
    visitElements(tree, (el, parent, index) => {
      if (el.tagName !== 'table') return;
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: 'Scrollable table' },
        children: [el],
      };
    });
  };
}

const renderer = unified()
  // Raw HTML in Markdown is intentionally dropped (remark-rehype default): content stays Markdown-only.
  .use(remarkRehype)
  .use(rehypeMermaidPlaceholder)
  .use(rehypeTableWrapper)
  .use(rehypeExternalLinks)
  .use(rehypeShiki, {
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
    langs: [...SHIKI_LANGS],
    langAlias: { ts: 'typescript', js: 'javascript', sh: 'bash', shell: 'bash', yml: 'yaml', cs: 'csharp', tf: 'hcl' },
    fallbackLanguage: 'text',
  })
  .use(rehypeStringify);

/** Render a slice of an mdast tree to an HTML string. */
export async function renderNodes(nodes: RootContent[]): Promise<string> {
  if (nodes.length === 0) return '';
  const root: MdRoot = { type: 'root', children: nodes };
  const hast = (await renderer.run(root)) as HastRoot;
  return renderer.stringify(hast);
}

/**
 * Render nodes and unwrap a single surrounding <p>, for inline-ish content
 * such as list items ("<p>foo</p>" → "foo").
 */
export async function renderInline(nodes: RootContent[]): Promise<string> {
  const html = (await renderNodes(nodes)).trim();
  const single = /^<p>([\s\S]*)<\/p>$/.exec(html);
  return single && !single[1]!.includes('<p>') ? single[1]! : html;
}
