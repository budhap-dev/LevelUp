// Pre-bundled copy of sanitize-html: see scripts/notes/bundle-sanitizer.ts for why.
import sanitizeHtml from './vendor/sanitize-html.js';

/** draw.io diagrams: an image embedded as a base64 SVG/PNG data URI (an <img> can't run scripts). */
const DIAGRAM_SRC = /^data:image\/(svg\+xml|png);base64,[A-Za-z0-9+/=]+$/;

/**
 * Allow-list for note HTML: exactly what the TipTap editor produces (StarterKit, task lists and
 * diagrams). Everything else, including scripts, styles, event handlers and linked images, is dropped.
 */
const NOTE_HTML: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre',
    'blockquote', 'ul', 'ol', 'li', 'hr', 'a', 'label', 'input', 'div', 'span', 'mark', 'figure', 'img',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    ol: ['start'],
    ul: ['data-type'],
    li: ['data-type', 'data-checked'],
    input: ['type', 'checked', 'disabled'],
    code: ['class'],
    figure: ['data-type'],
    img: ['src', 'alt'],
  },
  allowedClasses: { code: [/^language-[\w+#-]+$/] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['data'] },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }),
  },
  exclusiveFilter: (frame) =>
    (frame.tag === 'input' && frame.attribs.type !== 'checkbox') ||
    (frame.tag === 'img' && !DIAGRAM_SRC.test(frame.attribs.src ?? '')) ||
    (frame.tag === 'figure' && frame.attribs['data-type'] !== 'drawio'),
};

export function sanitizeNoteHtml(html: string): string {
  return sanitizeHtml(html, NOTE_HTML).trim();
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Plain text of note HTML, one line per block, for full-text search and list snippets. */
export function htmlToText(html: string): string {
  const withBreaks = html.replace(/<\/(p|h[1-6]|li|blockquote|pre|div)>|<br\s*\/?>/gi, '$&\n');
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
