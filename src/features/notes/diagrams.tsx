/**
 * Diagrams in notes.
 *
 * - Mermaid: a code block whose language is `mermaid` (stored as `<pre><code class="language-mermaid">`,
 *   which is also what a ```mermaid Markdown fence becomes) renders as a live diagram.
 * - draw.io: a `<figure data-type="drawio"><img src="data:image/svg+xml;base64,…"></figure>` block.
 *   The SVG is draw.io's "xmlsvg" export, which embeds the editable diagram, so it can be reopened
 *   in the embedded diagrams.net editor. Nothing is uploaded: the editor runs in an iframe and hands
 *   the SVG back through postMessage.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Node, mergeAttributes } from '@tiptap/core';
import { Selection, TextSelection } from '@tiptap/pm/state';
import { CodeBlock } from '@tiptap/extension-code-block';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type Editor, type ReactNodeViewProps } from '@tiptap/react';
import { renderMermaidSvg } from '@/lib/mermaid';
import { useTheme } from '@/lib/theme';
import { Icon } from '@/components/Icon';
import { useConfirm } from '@/components/ConfirmDialog';

/** Position of a just-inserted Mermaid block that should mount with its code open. */
const openOnMount = new WeakMap<Editor, number>();

/** Insert a Mermaid block with starter code and put the cursor at the end of that code. */
export function insertMermaid(editor: Editor) {
  editor
    .chain()
    .focus()
    .insertContent([
      { type: 'codeBlock', attrs: { language: 'mermaid' }, content: [{ type: 'text', text: MERMAID_STARTER }] },
      { type: 'paragraph' },
    ])
    .command(({ tr }) => {
      // The cursor is now in the paragraph after the new block; step back into the code.
      const paragraphStart = tr.selection.$from.before();
      const block = tr.doc.resolve(paragraphStart).nodeBefore;
      if (block?.type.name === 'codeBlock') {
        tr.setSelection(TextSelection.create(tr.doc, paragraphStart - 1));
        openOnMount.set(editor, paragraphStart - block.nodeSize);
      }
      return true;
    })
    .run();
}

const MERMAID_STARTER = 'flowchart LR\n  A[Client] --> B{Cache hit?}\n  B -- yes --> C[Return cached]\n  B -- no --> D[(Database)]';

/* ------------------------------------------------------------------ Mermaid */

/** StarterKit's code block, rendering `mermaid` blocks as diagrams. */
export const CodeBlockWithDiagrams = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});

function CodeBlockView(props: ReactNodeViewProps) {
  const language = props.node.attrs.language as string | null;
  if (language === 'mermaid') return <MermaidBlock {...props} />;
  return (
    <NodeViewWrapper as="pre">
      <NodeViewContent<'code'> as="code" className={language ? `language-${language}` : undefined} />
    </NodeViewWrapper>
  );
}

type Preview = { svg: string } | { error: string } | null;

function MermaidBlock({ node, editor, getPos }: ReactNodeViewProps) {
  const source = node.textContent;
  // Open for editing when empty, or when just inserted from the toolbar.
  const [editing, setEditing] = useState(() => {
    const fresh = openOnMount.get(editor) === getPos();
    if (fresh) openOnMount.delete(editor);
    return fresh || !source.trim();
  });
  const [preview, setPreview] = useState<Preview>(null);
  const { theme, mode } = useTheme();
  const hasRendered = useRef(false);

  // Render the diagram; while typing, wait for a pause first.
  useEffect(() => {
    if (!source.trim()) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(
      () => {
        renderMermaidSvg(source, theme, mode === 'dark').then(
          (svg) => !cancelled && setPreview({ svg }),
          (error: unknown) =>
            !cancelled && setPreview({ error: navigator.onLine === false && !hasRendered.current ? 'Diagrams need a connection the first time they load.' : (error as Error).message }),
        );
        hasRendered.current = true;
      },
      hasRendered.current ? 400 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, theme, mode]);

  // Moving the cursor into the (hidden) source, e.g. with the arrow keys, opens it for editing.
  useEffect(() => {
    const onSelection = () => {
      const pos = getPos();
      if (typeof pos !== 'number' || !editor.isFocused) return;
      const { from } = editor.state.selection;
      if (from > pos && from < pos + node.nodeSize) setEditing(true);
    };
    editor.on('selectionUpdate', onSelection);
    return () => void editor.off('selectionUpdate', onSelection);
  }, [editor, getPos, node.nodeSize]);

  const done = () => {
    setEditing(false);
    const pos = getPos();
    if (typeof pos !== 'number') return;
    // Put the cursor after the diagram (adding a paragraph if it's the last block) so typing doesn't edit the hidden source.
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const end = pos + node.nodeSize;
        if (end >= tr.doc.content.size) tr.insert(end, editor.schema.nodes.paragraph!.create());
        tr.setSelection(Selection.near(tr.doc.resolve(end), 1));
        return true;
      })
      .run();
  };

  const edit = () => {
    setEditing(true);
    const pos = getPos();
    if (typeof pos === 'number') editor.chain().focus(pos + node.nodeSize - 1).run();
  };

  return (
    <NodeViewWrapper className="note-diagram" data-diagram="mermaid">
      <div contentEditable={false} className="note-diagram-bar">
        <span className="flex items-center gap-1.5">
          <Icon name="flowchart" className="size-3.5" /> Mermaid diagram
        </span>
        <button type="button" className="note-diagram-button" onClick={editing ? done : edit}>
          {editing ? 'Done' : 'Edit code'}
        </button>
      </div>
      <pre className={editing ? 'note-diagram-source' : 'hidden'}>
        <NodeViewContent<'code'> as="code" className="language-mermaid" />
      </pre>
      <div contentEditable={false}>
        {!source.trim() ? (
          <p className="px-4 py-3 text-sm text-muted">
            Write Mermaid code above —{' '}
            <a href="https://mermaid.js.org/intro/syntax-reference.html" target="_blank" rel="noopener noreferrer" className="text-accent-ink underline">
              syntax reference
            </a>
            .
          </p>
        ) : preview && 'svg' in preview ? (
          <div
            className="mermaid-diagram"
            data-state="rendered"
            role="img"
            aria-label={`Diagram: ${source.split('\n')[0]?.trim() ?? 'diagram'}`}
            onDoubleClick={edit}
            // Mermaid renders with securityLevel 'strict', which sanitises labels and drops scripts.
            dangerouslySetInnerHTML={{ __html: preview.svg }}
          />
        ) : preview && 'error' in preview ? (
          <p role="alert" className="px-4 py-3 font-mono text-xs whitespace-pre-wrap text-muted">
            {preview.error}
          </p>
        ) : (
          <p className="px-4 py-3 text-sm text-muted">Rendering…</p>
        )}
      </div>
    </NodeViewWrapper>
  );
}

/* ------------------------------------------------------------------ draw.io */

export const DRAWIO_ORIGIN = 'https://embed.diagrams.net';
const DRAWIO_SRC = /^data:image\/(svg\+xml|png);base64,[A-Za-z0-9+/=]+$/;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawio: {
      /** Insert a draw.io diagram (an SVG data URI exported with the diagram embedded). */
      insertDrawio: (src: string) => ReturnType;
    };
  }
}

export const Drawio = Node.create({
  name: 'drawio',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el) => el.querySelector('img')?.getAttribute('src') ?? null,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="drawio"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-type': 'drawio' }), ['img', { src: node.attrs.src ?? '', alt: 'draw.io diagram' }]];
  },

  addCommands() {
    return {
      insertDrawio:
        (src) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src } }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawioView);
  },
});

function DrawioView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const [open, setOpen] = useState(false);
  const src = node.attrs.src as string | null;
  const onSave = useCallback((next: string) => updateAttributes({ src: next }), [updateAttributes]);
  const onClose = useCallback(() => setOpen(false), []);
  const [confirm, confirmDialog] = useConfirm();
  const remove = async () => {
    if (await confirm({ title: 'Remove this diagram?', message: 'The draw.io diagram will be removed from the note. You can undo this with Ctrl/Cmd+Z.', confirmLabel: 'Remove diagram' })) deleteNode();
  };

  return (
    <NodeViewWrapper className={`note-diagram ${selected ? 'is-selected' : ''}`} data-diagram="drawio">
      <div contentEditable={false} className="note-diagram-bar">
        <span className="flex items-center gap-1.5">
          <Icon name="shapes" className="size-3.5" /> draw.io diagram
        </span>
        <span className="flex gap-1">
          <button type="button" className="note-diagram-button" onClick={() => setOpen(true)}>
            Edit diagram
          </button>
          <button type="button" className="note-diagram-button is-danger" aria-label="Remove diagram" title="Remove diagram" onClick={() => void remove()}>
            <Icon name="trash" className="size-3.5" />
          </button>
        </span>
      </div>
      <div contentEditable={false} className="note-drawio-canvas" onDoubleClick={() => setOpen(true)}>
        {src && DRAWIO_SRC.test(src) ? <img src={src} alt="draw.io diagram" draggable={false} /> : <p className="text-sm text-muted">This diagram is empty.</p>}
      </div>
      {open && <DrawioDialog src={src} onSave={onSave} onClose={onClose} />}
      {confirmDialog}
    </NodeViewWrapper>
  );
}

interface DrawioMessage {
  event?: string;
  xml?: string;
  data?: string;
  exit?: boolean;
}

/**
 * Full-screen diagrams.net editor (embed mode, JSON protocol).
 * Load → user edits → "Save & Exit" sends `save` → we ask for an `xmlsvg` export → `export` returns the SVG data URI.
 */
export function DrawioDialog({ src, onSave, onClose }: { src: string | null; onSave: (src: string) => void; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const exitAfterExport = useRef(false);
  const onSaveRef = useRef(onSave);
  const onCloseRef = useRef(onClose);
  onSaveRef.current = onSave;
  onCloseRef.current = onClose;
  const initialSrc = useRef(src);

  useEffect(() => {
    const post = (message: object) => frame.current?.contentWindow?.postMessage(JSON.stringify(message), DRAWIO_ORIGIN);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== DRAWIO_ORIGIN || event.source !== frame.current?.contentWindow || typeof event.data !== 'string') return;
      let msg: DrawioMessage;
      try {
        msg = JSON.parse(event.data) as DrawioMessage;
      } catch {
        return;
      }
      switch (msg.event) {
        case 'init':
          post({ action: 'load', xml: initialSrc.current ?? '', autosave: 0, title: 'Diagram' });
          break;
        case 'save':
          exitAfterExport.current = msg.exit === true;
          post({ action: 'export', format: 'xmlsvg', xml: msg.xml, spinKey: 'saving' });
          break;
        case 'export':
          if (typeof msg.data === 'string' && DRAWIO_SRC.test(msg.data)) {
            onSaveRef.current(msg.data);
            post({ action: 'status', modified: false });
          }
          if (exitAfterExport.current) onCloseRef.current();
          break;
        case 'exit':
          onCloseRef.current();
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const url = `${DRAWIO_ORIGIN}/?embed=1&proto=json&spin=1&saveAndExit=1&noSaveBtn=1&ui=min&dark=0`;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="draw.io editor" className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 text-sm">
        <span className="flex items-center gap-2 font-semibold text-fg">
          <Icon name="shapes" /> draw.io diagram
          <span className="hidden font-normal text-muted sm:inline">· editor by diagrams.net, needs a connection</span>
        </span>
        <button type="button" onClick={onClose} className="rounded-md px-2.5 py-1 font-semibold text-fg-soft hover:bg-subtle hover:text-fg">
          Cancel
        </button>
      </div>
      <iframe ref={frame} title="draw.io editor" src={url} className="min-h-0 w-full flex-1 border-0" />
    </div>,
    document.body,
  );
}
